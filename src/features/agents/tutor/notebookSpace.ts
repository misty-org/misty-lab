import { useEffect } from "react";
import { useSpaceWindowStore } from "@/features/app-windows";
import { spacesGateway } from "../spaces-gateway/spacesGateway";
import { NOTEBOOK_DOC_PREFIX, notebookMarkdown, spaceNotesOf } from "./notebookMarkdown";
import { useTutorStore } from "./tutorStore";
import type { Notebook } from "./tutorTypes";

const placing = new Set<string>();

export async function placeNotebook(notebookId: string, spaceId: string): Promise<void> {
  const gateway = spacesGateway.maybe();
  const notebook = useTutorStore.getState().notebooks[notebookId];
  if (!gateway || !notebook || notebook.space || placing.has(notebookId)) return;
  placing.add(notebookId);
  try {
    const shared = notebook.shared;
    if (shared) {
      const kept = spaceNotesOf(
        await gateway.readDoc(shared.spaceId, shared.docId).catch(() => ""),
      );
      if (kept) useTutorStore.getState().saveNote(notebookId, { title: "Space notes", body: kept });
      return link(
        notebookId,
        { spaceId: shared.spaceId, docId: shared.docId },
        gateway.me()?.userId,
      );
    }
    const doc = await gateway.createNotebookDoc(
      spaceId,
      `${NOTEBOOK_DOC_PREFIX}${notebook.title}`,
      notebookMarkdown(notebook),
    );
    link(notebookId, { spaceId, docId: doc.id }, gateway.me()?.userId);
  } finally {
    placing.delete(notebookId);
  }
}

function link(notebookId: string, space: NonNullable<Notebook["space"]>, createdBy?: string) {
  useTutorStore
    .getState()
    .updateNotebook(notebookId, ({ shared: _shared, savedFrom: _saved, ...rest }) => ({
      ...rest,
      space,
      createdBy: rest.createdBy ?? createdBy,
    }));
}

export function notebookRoute(notebook: Pick<Notebook, "id" | "space">): string {
  const spaceId = notebook.space?.spaceId || useSpaceWindowStore.getState().personalSpaceId || "";
  return `/spaces/${encodeURIComponent(spaceId)}/lab?item=notebook:${encodeURIComponent(notebook.id)}`;
}

export async function deleteNotebook(notebookId: string): Promise<void> {
  const store = useTutorStore.getState();
  const notebook = store.notebooks[notebookId];
  if (!notebook) return;
  if (notebook.space)
    await spacesGateway.get().deleteNotebookDoc(notebook.space.spaceId, notebook.space.docId);
  for (const deck of Object.values(store.decks))
    if (deck.notebookId === notebookId) store.removeDeck(deck.id);
  for (const guide of Object.values(store.guides))
    if (guide.notebookId === notebookId) store.removeGuide(guide.id);
  store.removeNotebook(notebookId);
}

const mirrorId = (docId: string) => `notebook-${docId}`;

export async function listSpaceNotebooks(spaceId: string): Promise<void> {
  const gateway = spacesGateway.maybe();
  if (!gateway) return;
  const docs = (await gateway.notebookDocs(spaceId)).filter((doc) =>
    doc.title.startsWith(NOTEBOOK_DOC_PREFIX),
  );
  const store = useTutorStore.getState();
  const mine = Object.values(store.notebooks).filter((item) => item.space?.spaceId === spaceId);
  const known = new Set(mine.map((item) => item.space!.docId));
  const at = new Date().toISOString();
  for (const doc of docs) {
    if (known.has(doc.id)) continue;
    const notebook: Notebook = {
      id: mirrorId(doc.id),
      title: doc.title.slice(NOTEBOOK_DOC_PREFIX.length).trim() || "Untitled notebook",
      sources: [],
      notes: [],
      transformations: [],
      chats: [],
      space: { spaceId, docId: doc.id },
      createdBy: doc.creatorId || undefined,
      createdAt: doc.updatedAt ?? at,
      updatedAt: doc.updatedAt ?? at,
    };
    useTutorStore.setState((state) => ({
      notebooks: { ...state.notebooks, [notebook.id]: notebook },
    }));
    store.updateNotebook(notebook.id, (current) => current);
  }
  const listed = new Set(docs.map((doc) => doc.id));
  const settled = Date.now() - 60_000;
  for (const notebook of mine)
    if (!listed.has(notebook.space!.docId) && Date.parse(notebook.createdAt) < settled)
      store.removeNotebook(notebook.id);
}

export function useNotebooksInSpace(spaceId: string | undefined) {
  const notebooks = useTutorStore((state) => state.notebooks);
  const ready = useTutorStore((state) => state.ready);
  useEffect(() => {
    if (!spaceId || !ready) return;
    for (const notebook of Object.values(notebooks))
      if (!notebook.space) void placeNotebook(notebook.id, spaceId).catch(() => undefined);
  }, [spaceId, ready, notebooks]);
  useEffect(() => {
    if (!spaceId || !ready) return;
    const refresh = () => void listSpaceNotebooks(spaceId).catch(() => undefined);
    refresh();
    const onEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ space_id?: string }>).detail;
      if (!detail?.space_id || detail.space_id === spaceId) refresh();
    };
    window.addEventListener("misty:space-note-event", onEvent);
    return () => window.removeEventListener("misty:space-note-event", onEvent);
  }, [spaceId, ready]);
}
