import { useEffect, useState } from "react";
import { usePersonalAgentsStore } from "../personal/personal_agents_store";
import { useLiveNotebook } from "./notebook_live";
import { setPresence, type NotebookPane } from "./notebook_presence";
import { useTutorStore } from "./tutor_store";
import type { TutorJob } from "./tutor_types";

export type AgentWork = "finding" | "overview" | "summarizing" | "note" | "making";

export interface AgentAtWork {
  agentId: string;
  name: string;
  engine?: string;
  emoji?: string;
  work: AgentWork;
  kind?: TutorJob["kind"];
  item?: string;
}

export interface NotebookAgent extends AgentAtWork {
  key: string;
  ownerId: string;
  ownerName: string;
  mine: boolean;
}

const workOf: Record<TutorJob["kind"], AgentWork> = {
  research: "finding",
  brief: "overview",
  summary: "summarizing",
  note: "note",
  guide: "making",
  deck: "making",
  quiz: "making",
  overview: "making",
  mindmap: "making",
  slides: "making",
  infographic: "making",
  video: "making",
};

export function paneOf(work: AgentWork): NotebookPane | undefined {
  if (work === "finding" || work === "summarizing") return "sources";
  if (work === "making") return "studio";
  return undefined;
}

const makes: Partial<Record<TutorJob["kind"], string>> = {
  guide: "a report",
  deck: "flashcards",
  quiz: "a quiz",
  overview: "an audio overview",
  mindmap: "a mind map",
  slides: "slides",
  infographic: "an infographic",
  video: "a video overview",
};

export function workWords(agent: Pick<AgentAtWork, "work" | "kind">): string {
  switch (agent.work) {
    case "finding":
      return "is finding sources";
    case "overview":
      return "is writing the overview";
    case "summarizing":
      return "is summarizing a source";
    case "note":
      return "is writing a note";
    case "making":
      return `is making ${(agent.kind && makes[agent.kind]) ?? "something"}`;
  }
}

export const agentLabel = (agent: Pick<NotebookAgent, "name" | "ownerName" | "mine">) =>
  agent.mine ? agent.name : `${agent.ownerName}'s ${agent.name}`;

export function agentsAtWork(
  jobs: readonly TutorJob[],
  notebookId: string,
  profiles: readonly { id: string; name: string; engine?: string; avatar?: { emoji?: unknown } }[],
): AgentAtWork[] {
  const seen = new Set<string>();
  return jobs
    .filter(
      (job) => job.notebookId === notebookId && (job.state === "queued" || job.state === "running"),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .flatMap((job): AgentAtWork[] => {
      if (seen.has(job.agentId)) return [];
      seen.add(job.agentId);
      const profile = profiles.find((agent) => agent.id === job.agentId);
      const emoji = profile?.avatar?.emoji;
      return [
        {
          agentId: job.agentId,
          name: profile?.name || "Agent",
          engine: profile?.engine,
          emoji: typeof emoji === "string" && emoji ? emoji : undefined,
          work: workOf[job.kind],
          kind: workOf[job.kind] === "making" ? job.kind : undefined,
          item: job.kind === "summary" || job.kind === "note" ? job.sourceId : undefined,
        },
      ];
    });
}

export function usePublishAgents(notebookId: string) {
  const entry = useLiveNotebook(notebookId);
  const jobs = useTutorStore((state) => state.jobs);
  const profiles = usePersonalAgentsStore((state) => state.agents);
  useEffect(() => {
    if (!entry) return;
    setPresence(notebookId, { agents: agentsAtWork(Object.values(jobs), notebookId, profiles) });
  }, [entry, notebookId, jobs, profiles]);
}

export function useNotebookAgents(notebookId: string): NotebookAgent[] {
  const entry = useLiveNotebook(notebookId);
  const jobs = useTutorStore((state) => state.jobs);
  const profiles = usePersonalAgentsStore((state) => state.agents);
  const [others, setOthers] = useState<NotebookAgent[]>([]);
  useEffect(() => {
    if (!entry) return setOthers([]);
    const awareness = entry.live.awareness;
    const read = () => {
      const found = new Map<string, NotebookAgent>();
      awareness.getStates().forEach((state, clientId) => {
        const user = state.user as { id?: string; name?: string } | undefined;
        if (clientId === awareness.clientID || !user?.id || user.id === entry.me) return;
        const agents = ((state.lab as { agents?: AgentAtWork[] } | undefined)?.agents ?? [])
          .filter((agent) => agent && typeof agent.agentId === "string")
          .slice(0, 6);
        for (const agent of agents)
          found.set(`${user.id}:${agent.agentId}`, {
            ...agent,
            key: `${user.id}:${agent.agentId}`,
            ownerId: user.id,
            ownerName: user.name || "Someone",
            mine: false,
          });
      });
      setOthers([...found.values()]);
    };
    read();
    awareness.on("change", read);
    return () => awareness.off("change", read);
  }, [entry]);
  const mine = agentsAtWork(Object.values(jobs), notebookId, profiles).map((agent) => ({
    ...agent,
    key: `me:${agent.agentId}`,
    ownerId: entry?.me ?? "",
    ownerName: "You",
    mine: true,
  }));
  return [...mine, ...others];
}
