import { useMistyStore } from "../conversations/state/useMistyStore";
import { readRunState } from "../runs/invocations/invocationSubscription";
import { makeOverviewAudio, makeVideoAudio } from "./tutorAudio";
import { parseDeck, parseMarkdown, parseOverview, parseQuiz } from "./tutorPrompts";
import { agentTag } from "./agentTag";
import { addLink } from "./tutorSources";
import {
  briefKey,
  parseBrief,
  parseInfographic,
  parseMindmap,
  parseResearch,
  parseVideo,
  slidesOf,
} from "./tutorStudio";
import { useTutorStore } from "./tutorStore";
import type { TutorJob, TutorJobKind } from "./tutorTypes";
import { defaultEngineAgent } from "../engines/defaultEngine";
import {
  defaultEngineId,
  followEngineRun,
  noDefaultEngine,
  runOnEngine,
  stopEngineRun,
  type EngineRunResult,
} from "../engines/engineRun";

export { startRun } from "../conversations/startRun";

export const unusableReply = "The reply had nothing Misty could use.";

export async function startJob(input: {
  kind: TutorJobKind;
  title: string;
  agentId?: string;
  prompt: string;
  notebookId?: string;
  sourceId?: string;
  transformation?: string;
  report?: string;
}): Promise<TutorJob> {
  const now = new Date().toISOString();
  const engineId = await defaultEngineId().catch(() => "");
  const job: TutorJob = {
    ...input,
    agentId: (engineId && defaultEngineAgent(engineId)) || engineId,
    id: `job-${crypto.randomUUID()}`,
    state: engineId ? "running" : "failed",
    ...(engineId ? {} : { error: noDefaultEngine }),
    createdAt: now,
    updatedAt: now,
  };
  useTutorStore.getState().saveJob(job);
  if (engineId) void run(job);
  return job;
}

const following = new Set<string>();

const spaceOf = (job: TutorJob) =>
  job.notebookId ? useTutorStore.getState().notebooks[job.notebookId]?.space?.spaceId : undefined;

async function run(job: TutorJob, existingRun?: string): Promise<void> {
  if (following.has(job.id)) return;
  following.add(job.id);
  try {
    const result = existingRun
      ? await followEngineRun(existingRun)
      : await runOnEngine({
          prompt: job.prompt,
          key: `${job.id}:${job.restarts ?? 0}`,
          spaceId: spaceOf(job),
          onStarted: (runId) => {
            const current = useTutorStore.getState().jobs[job.id];
            if (current) useTutorStore.getState().saveJob({ ...current, runId });
          },
        });
    finish(job.id, result);
  } catch (reason) {
    finish(job.id, {
      runId: "",
      text: "",
      error: reason instanceof Error ? reason.message : String(reason),
    });
  } finally {
    following.delete(job.id);
  }
}

function finish(jobId: string, result: EngineRunResult) {
  const current = useTutorStore.getState().jobs[jobId];
  if (!current || current.state !== "running") return;
  const now = new Date().toISOString();
  if (result.error && !result.text.trim()) {
    useTutorStore
      .getState()
      .saveJob({ ...current, state: "failed", error: result.error, updatedAt: now });
    return;
  }
  const resultId = settle(current, result.text);
  useTutorStore
    .getState()
    .saveJob(
      resultId
        ? { ...current, state: "done", error: undefined, resultId, updatedAt: now }
        : { ...current, state: "failed", error: result.error || unusableReply, updatedAt: now },
    );
}

export async function dismissJob(job: TutorJob): Promise<void> {
  if (job.state === "running" && job.runId) await stopEngineRun(job.runId);
  useTutorStore.getState().removeJob(job.id);
}

export function retryJob(job: TutorJob): Promise<TutorJob> {
  const again: TutorJob = {
    ...job,
    state: "running",
    error: undefined,
    runId: undefined,
    restarts: (job.restarts ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  useTutorStore.getState().saveJob(again);
  void run(again);
  return Promise.resolve(again);
}

function settle(job: TutorJob, reply: string): string | undefined {
  const tutor = useTutorStore.getState();
  const now = new Date().toISOString();
  const base = {
    notebookId: job.notebookId,
    createdAt: now,
    updatedAt: now,
  };
  const fallbackTitle = job.title.replace(/^[^:]+:\s*/, "");
  if (job.kind === "deck") {
    const deck = parseDeck(reply);
    if (!deck) return undefined;
    return tutor.newDeck({ ...base, title: deck.title || fallbackTitle }, deck.cards).id;
  }
  if (job.kind === "quiz") {
    const quiz = parseQuiz(reply);
    if (!quiz) return undefined;
    const id = `quiz-${crypto.randomUUID()}`;
    tutor.saveGuide({
      ...base,
      id,
      kind: "quiz",
      title: quiz.title || fallbackTitle,
      body: "",
      questions: quiz.questions,
    });
    return id;
  }
  if (job.kind === "infographic") {
    const svg = parseInfographic(reply);
    if (!svg) return undefined;
    const id = `infographic-${crypto.randomUUID()}`;
    tutor.saveGuide({ ...base, id, kind: "infographic", title: fallbackTitle, body: svg });
    return id;
  }
  if (job.kind === "video") {
    const video = parseVideo(reply);
    if (!video) return undefined;
    const id = `video-${crypto.randomUUID()}`;
    tutor.saveGuide({
      ...base,
      id,
      kind: "video",
      title: video.title || fallbackTitle,
      body: "",
      scenes: video.scenes,
      audio: { state: "making" },
    });
    void makeVideoAudio(id);
    return id;
  }
  if (job.kind === "mindmap") {
    const map = parseMindmap(reply);
    if (!map) return undefined;
    const id = `mindmap-${crypto.randomUUID()}`;
    tutor.saveGuide({ ...base, id, kind: "mindmap", title: map.title, body: "", map: map.root });
    return id;
  }
  if (job.kind === "research" && job.notebookId) {
    const found = parseResearch(reply);
    if (!found.length) return undefined;
    const notebookId = job.notebookId;
    const have = new Set(
      (tutor.notebooks[notebookId]?.sources ?? []).map((source) => source.url).filter(Boolean),
    );
    for (const item of found.filter((item) => !have.has(item.url))) {
      void addLink(notebookId, item.url, item.title).then(() => undefined);
      const added = useTutorStore
        .getState()
        .notebooks[notebookId]?.sources.find((source) => source.url === item.url);
      if (added)
        tutor.updateSource(notebookId, added.id, { why: item.why, agent: agentTag(job.agentId) });
    }
    return notebookId;
  }
  if (job.kind === "brief" && job.notebookId) {
    const brief = parseBrief(reply);
    const notebook = tutor.notebooks[job.notebookId];
    if (!brief || !notebook) return undefined;
    tutor.updateNotebook(notebook.id, (current) => ({
      ...current,
      emoji: brief.emoji || current.emoji,
      title: current.title === "Untitled notebook" && brief.title ? brief.title : current.title,
      brief: {
        summary: brief.summary,
        topics: brief.topics,
        questions: brief.questions,
        sources: briefKey(current),
      },
    }));
    return notebook.id;
  }
  if (job.kind === "overview") {
    const overview = parseOverview(reply);
    if (!overview) return undefined;
    const id = `overview-${crypto.randomUUID()}`;
    tutor.saveGuide({
      ...base,
      id,
      kind: "overview",
      title: overview.title || fallbackTitle,
      body: "",
      script: overview.lines,
      audio: { state: "making" },
    });
    void makeOverviewAudio(id);
    return id;
  }
  const markdown = parseMarkdown(reply);
  if (!markdown) return undefined;
  if (job.kind === "slides") {
    const id = `slides-${crypto.randomUUID()}`;
    if (slidesOf(markdown.body).length < 2) return undefined;
    tutor.saveGuide({
      ...base,
      id,
      kind: "slides",
      title: markdown.title || fallbackTitle,
      body: markdown.body,
    });
    return id;
  }
  if (job.kind === "guide") {
    const id = `guide-${crypto.randomUUID()}`;
    tutor.saveGuide({
      ...base,
      id,
      kind: "guide",
      report: job.report,
      title: markdown.title || fallbackTitle,
      body: markdown.body,
    });
    return id;
  }
  if (!job.notebookId) return undefined;
  if (job.kind === "summary" && job.sourceId) {
    tutor.updateSource(job.notebookId, job.sourceId, { summary: markdown.body });
    return job.sourceId;
  }
  return tutor.saveNote(job.notebookId, {
    title: fallbackTitle,
    body: markdown.body,
    origin: "agent",
    transformation: job.transformation,
    sourceId: job.sourceId,
    agent: agentTag(job.agentId),
  }).id;
}

export function interrupted(error?: string): boolean {
  return /account changed|closed before|Open Misty again|stopped before it finished/i.test(
    error ?? "",
  );
}

async function resumeJobs() {
  for (const job of Object.values(useTutorStore.getState().jobs)) {
    if (job.state === "queued") {
      void retryJob({ ...job, restarts: (job.restarts ?? 0) - 1 });
      continue;
    }
    if (job.state !== "running") continue;
    const state = job.runId ? await readRunState(job.runId).catch(() => "missing") : "missing";
    if (state !== "missing" && job.runId) {
      void run(job, job.runId);
      continue;
    }
    if ((job.restarts ?? 0) < 1) void retryJob(job);
    else
      useTutorStore.getState().saveJob({
        ...job,
        state: "failed",
        error: "This run stopped before it finished.",
        updatedAt: new Date().toISOString(),
      });
  }
}

export function followTutorJobs(accountId: string): () => void {
  void useTutorStore
    .getState()
    .load(accountId)
    .then(() => {
      void resumeJobs();
      const tutor = useTutorStore.getState();
      for (const guide of Object.values(tutor.guides)) {
        if (guide.audio?.state === "making")
          void (guide.kind === "video" ? makeVideoAudio(guide.id) : makeOverviewAudio(guide.id));
      }
    });
  return () => undefined;
}
