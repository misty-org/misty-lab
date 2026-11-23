import { useEffect, useState } from "react";
import * as Y from "yjs";
import { SetupState } from "@misty/ui";
import { spacesGateway } from "../../spaces-gateway/spaces_gateway";
import { noteMap, noteSeed, setNoteMarkdown, takeLease } from "../notebook_doc";
import { liveNotebookError, retryLiveNotebook, useLiveNotebook } from "../notebook_live";
import { setPresence } from "../notebook_presence";
import { personColor } from "../person_tone";
import type { NotebookNote } from "../tutor_types";

export function LiveNoteBody({ notebookId, note }: { notebookId: string; note: NotebookNote }) {
  const entry = useLiveNotebook(notebookId);
  const gateway = spacesGateway.maybe();
  const me = gateway?.me();
  const map = entry ? noteMap(entry.live.doc, note.id) : undefined;
  const fragment = map?.get("body");
  const [seed, setSeed] = useState<string>();
  useEffect(() => {
    if (!entry || !map || noteSeed(map) === undefined) return;
    let current = true;
    void takeLease(entry.live.doc, `seed:${note.id}`, entry.me, 10_000).then((mine) => {
      const wanted = noteSeed(map);
      if (current && mine && wanted !== undefined) setSeed(wanted);
    });
    return () => {
      current = false;
    };
  }, [entry, map, note.id]);
  useEffect(() => () => setPresence(notebookId, { editing: undefined }), [notebookId]);
  if (!entry || !gateway || !me || !(fragment instanceof Y.XmlFragment))
    return (
      <SetupState
        tool="shared note"
        label="Opening the shared note"
        size="inline"
        error={entry ? null : liveNotebookError(notebookId)}
        onRetry={() => retryLiveNotebook(notebookId)}
      />
    );
  const Editor = gateway.NoteBodyEditor;
  return (
    <Editor
      fragment={fragment}
      awareness={entry.live.awareness}
      user={{ id: me.userId, name: me.name, color: personColor(me.userId) }}
      editable={entry.live.role !== "viewer"}
      label="Note"
      seed={seed}
      onSeeded={() => setSeed(undefined)}
      onMarkdown={(markdown) => setNoteMarkdown(entry.live.doc, note.id, markdown)}
      onFocusChange={(focused) =>
        setPresence(notebookId, { editing: focused ? note.id : undefined })
      }
    />
  );
}
