import { MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNow } from "@/shared/hooks/use_now";
import { Button, OverflowFadeText, Text } from "@misty/ui";
import { agoWords } from "../../page/use_chat_statuses";
import { spacesGateway } from "../../spaces-gateway/spaces_gateway";
import { NOTEBOOK_DOC_PREFIX } from "../notebook_markdown";
import { liveNotebook } from "../notebook_live";
import { takeLease } from "../notebook_doc";
import type { NotebookAgent } from "../notebook_agents";
import type { Person } from "../notebook_presence";
import { useTutorStore } from "../tutor_store";
import type { Notebook } from "../tutor_types";
import { FacePile } from "./LivePeople";

interface Done {
  by: string;
  agent?: { id: string; name: string };
  kind: "source" | "note" | "answer" | "made";
  title: string;
  at: string;
}

const togetherMs = 10 * 60_000;
const recentMs = 24 * 60 * 60_000;

export function lastActivity(
  notebook: Notebook,
  outputs: { title: string; by?: string; createdAt: string }[],
  me: string | undefined,
  now: number,
  only?: string,
): { done: Done; count: number } | null {
  const done: Done[] = [
    ...notebook.sources.map((source) => ({
      by: source.addedBy ?? "",
      agent: source.agent,
      kind: "source" as const,
      title: source.title,
      at: source.createdAt,
    })),
    ...notebook.notes.map((note) => ({
      by: note.authorId ?? "",
      agent: note.agent,
      kind: note.fromQuestion ? ("answer" as const) : ("note" as const),
      title: note.title,
      at: note.createdAt,
    })),
    ...outputs.map((output) => ({
      by: output.by ?? "",
      agent: undefined,
      kind: "made" as const,
      title: output.title,
      at: output.createdAt,
    })),
  ]
    .filter(
      (item) =>
        item.by &&
        (item.by !== me || item.agent) &&
        (!only || item.by === only) &&
        now - Date.parse(item.at) < recentMs,
    )
    .sort((a, b) => b.at.localeCompare(a.at));
  const latest = done[0];
  if (!latest) return null;
  const count = done.filter(
    (item) =>
      item.by === latest.by &&
      item.agent?.id === latest.agent?.id &&
      item.kind === latest.kind &&
      Date.parse(latest.at) - Date.parse(item.at) < togetherMs,
  ).length;
  return { done: latest, count };
}

export function doerName(
  done: Pick<Done, "by" | "agent">,
  me: string | undefined,
  spaceId: string,
  memberName: (spaceId: string, userId: string) => string,
): string {
  if (!done.agent) return memberName(spaceId, done.by);
  return done.by === me ? done.agent.name : `${memberName(spaceId, done.by)}'s ${done.agent.name}`;
}

export function activityWords(
  name: string,
  { done, count }: { done: Done; count: number },
): string {
  switch (done.kind) {
    case "source":
      return count > 1 ? `${name} added ${count} sources` : `${name} added ${done.title}`;
    case "note":
      return count > 1 ? `${name} added ${count} notes` : `${name} added a note`;
    case "answer":
      return count > 1 ? `${name} added ${count} answers` : `${name} added an answer`;
    case "made":
      return `${name} made ${done.title}`;
  }
}

export function useOthersInSpace(spaceId: string | undefined): boolean {
  const [others, setOthers] = useState(false);
  useEffect(() => {
    const gateway = spacesGateway.maybe();
    setOthers(false);
    if (!spaceId || !gateway) return;
    let current = true;
    void gateway
      .otherMembers(spaceId)
      .then((members) => current && setOthers(members.length > 0))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [spaceId]);
  return others;
}

export function NotebookPeople({
  notebook,
  people,
  agents = [],
}: {
  notebook: Notebook;
  people: Person[];
  agents?: NotebookAgent[];
}) {
  const navigate = useNavigate();
  const now = useNow();
  const gateway = spacesGateway.maybe();
  const spaceId = notebook.space?.spaceId;
  const me = gateway?.me()?.userId;
  const decks = useTutorStore((state) => state.decks);
  const guides = useTutorStore((state) => state.guides);
  const others = useOthersInSpace(spaceId);
  const [opening, setOpening] = useState(false);
  if (!spaceId || !gateway) return null;
  if (!others && !people.length)
    return agents.length ? <FacePile people={[]} agents={agents} notebook={notebook} /> : null;

  const outputs = [...Object.values(decks), ...Object.values(guides)].filter(
    (item) => item.notebookId === notebook.id,
  );
  const activity = lastActivity(notebook, outputs, me, now);
  const discuss = async () => {
    if (opening) return;
    setOpening(true);
    try {
      let id = useTutorStore.getState().notebooks[notebook.id]?.discussionId;
      const doc = liveNotebook(notebook.id)?.live.doc;
      if (!id && doc && me && !(await takeLease(doc, "discussion", me, 15_000))) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        id = useTutorStore.getState().notebooks[notebook.id]?.discussionId;
      }
      const chat = await gateway.discussion(spaceId, `${NOTEBOOK_DOC_PREFIX}${notebook.title}`, id);
      if (chat.id !== id)
        useTutorStore
          .getState()
          .updateNotebook(notebook.id, (current) => ({ ...current, discussionId: chat.id }));
      navigate(
        `/spaces/${encodeURIComponent(spaceId)}/chat?conversation=${encodeURIComponent(chat.id)}`,
      );
    } finally {
      setOpening(false);
    }
  };
  return (
    <>
      {activity ? (
        <Text bare size="caption" tone="muted" className="mr-2 min-w-0 max-w-60">
          <OverflowFadeText full>
            {activityWords(doerName(activity.done, me, spaceId, gateway.memberName), activity)}{" "}
            {agoWords(activity.done.at, now)}
          </OverflowFadeText>
        </Text>
      ) : null}
      <FacePile spaceId={spaceId} people={people} agents={agents} notebook={notebook} />
      <Button
        variant="quiet"
        icon={MessagesSquare}
        onClick={() => void discuss().catch(() => setOpening(false))}
      >
        Discuss
      </Button>
    </>
  );
}
