import { useEffect, useState, type RefObject } from "react";
import type { AvatarTone as ItemTone } from "@misty/ui";
import type { AgentAtWork } from "./notebook_agents";
import { liveNotebook, useLiveNotebook } from "./notebook_live";
import { personColor, personTone } from "./person_tone";

export type NotebookPane = "sources" | "chat" | "reader" | "studio";

export interface LabPresence {
  section?: NotebookPane;
  item?: string;
  editing?: string;
  asking?: boolean;
  pointer?: { pane: NotebookPane; anchor?: string; x: number; y: number } | null;
  agents?: AgentAtWork[];
}

export interface Person {
  clientId: number;
  id: string;
  name: string;
  tone: ItemTone;
  color: string;
  lab: LabPresence;
}

export function setPresence(notebookId: string, change: Partial<LabPresence>) {
  const entry = liveNotebook(notebookId);
  if (!entry) return;
  const awareness = entry.live.awareness;
  const current = (awareness.getLocalState()?.lab ?? {}) as LabPresence;
  const next = { ...current, ...change };
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  awareness.setLocalStateField("lab", next);
}

export function usePeople(notebookId: string): Person[] {
  const entry = useLiveNotebook(notebookId);
  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    if (!entry) return setPeople([]);
    const awareness = entry.live.awareness;
    const read = () => {
      const byPerson = new Map<string, Person>();
      awareness.getStates().forEach((state, clientId) => {
        const user = state.user as { id?: string; name?: string } | undefined;
        if (clientId === awareness.clientID || !user?.id || user.id === entry.me) return;
        const lab = (state.lab ?? {}) as LabPresence;
        const known = byPerson.get(user.id);
        if (known && (known.lab.pointer || known.lab.section) && !lab.pointer) return;
        byPerson.set(user.id, {
          clientId,
          id: user.id,
          name: user.name || "Someone",
          tone: personTone(user.id),
          color: personColor(user.id),
          lab,
        });
      });
      setPeople([...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name)));
    };
    read();
    awareness.on("change", read);
    return () => awareness.off("change", read);
  }, [entry]);
  return people;
}

export function anchorPoint(
  target: Element | null,
  clientX: number,
  clientY: number,
): LabPresence["pointer"] {
  const pane = target?.closest<HTMLElement>("[data-live-pane]");
  if (!pane) return null;
  const anchored = target?.closest<HTMLElement>("[data-live-anchor]");
  const box = (anchored && pane.contains(anchored) ? anchored : pane).getBoundingClientRect();
  if (!box.width || !box.height) return null;
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    pane: pane.dataset.livePane as NotebookPane,
    anchor: anchored && pane.contains(anchored) ? anchored.dataset.liveAnchor : undefined,
    x: round((clientX - box.left) / box.width),
    y: round((clientY - box.top) / box.height),
  };
}

export function usePublishPointer(notebookId: string, frame: RefObject<HTMLElement | null>) {
  const entry = useLiveNotebook(notebookId);
  useEffect(() => {
    const element = frame.current;
    if (!element || !entry) return;
    let last = 0;
    let queued: number | undefined;
    let latest: PointerEvent | undefined;
    const send = () => {
      queued = undefined;
      last = Date.now();
      if (!latest) return;
      const pointer = anchorPoint(latest.target as Element, latest.clientX, latest.clientY);
      setPresence(notebookId, { pointer, ...(pointer ? { section: pointer.pane } : {}) });
    };
    const move = (event: PointerEvent) => {
      latest = event;
      if (queued) return;
      queued = window.setTimeout(send, Math.max(0, 33 - (Date.now() - last)));
    };
    const leave = () => {
      latest = undefined;
      if (queued) window.clearTimeout(queued);
      queued = undefined;
      setPresence(notebookId, { pointer: null });
    };
    const focus = (event: FocusEvent) => {
      const pane = (event.target as Element | null)?.closest<HTMLElement>("[data-live-pane]");
      if (pane) setPresence(notebookId, { section: pane.dataset.livePane as NotebookPane });
    };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    element.addEventListener("focusin", focus);
    return () => {
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerleave", leave);
      element.removeEventListener("focusin", focus);
      if (queued) window.clearTimeout(queued);
    };
  }, [notebookId, frame, entry]);
}
