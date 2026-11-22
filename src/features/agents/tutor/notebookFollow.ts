import { latestNews } from "./notebookNews";
import { addLink, sourceLimit } from "./tutorSources";
import { useTutorStore } from "./tutorStore";
import type { Notebook, NotebookFollow } from "./tutorTypes";

const followStaleAfterMs = 30 * 60 * 1000;
const perLook = 6;
const keptNews = 15;

export function followIsStale(follow: NotebookFollow | undefined, now = Date.now()): boolean {
  if (!follow) return false;
  const checked = follow.checkedAt ? Date.parse(follow.checkedAt) : NaN;
  return !Number.isFinite(checked) || now - checked > followStaleAfterMs;
}

const units: Record<string, number> = {
  second: 1_000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_592_000_000,
  year: 31_536_000_000,
};

export function publishedAt(published: string | undefined, now = Date.now()): string | undefined {
  const text = published?.trim().toLowerCase();
  if (!text) return undefined;
  const relative = /^(\d+|an?|one)\s+(second|minute|hour|day|week|month|year)s?\s+ago$/.exec(text);
  if (relative) {
    const count = /^\d+$/.test(relative[1]!) ? Number(relative[1]) : 1;
    return new Date(now - count * units[relative[2]!]!).toISOString();
  }
  if (text === "yesterday") return new Date(now - units.day!).toISOString();
  const parsed = Date.parse(published!);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

export function newsToDrop(notebook: Notebook): string[] {
  const news = notebook.sources
    .filter((source) => source.news)
    .sort((a, b) => (b.published ?? b.createdAt).localeCompare(a.published ?? a.createdAt));
  return news.slice(keptNews).map((source) => source.id);
}

export function setFollow(notebookId: string, follow: NotebookFollow | undefined): void {
  useTutorStore.getState().updateNotebook(notebookId, (current) => ({ ...current, follow }));
}

const looking = new Set<string>();

export async function lookForNews(notebookId: string): Promise<string | null> {
  const store = useTutorStore.getState();
  const notebook = store.notebooks[notebookId];
  if (!notebook?.follow || looking.has(notebookId)) return null;
  looking.add(notebookId);
  try {
    const items = await latestNews(notebook.follow.query, "week");
    const current = useTutorStore.getState().notebooks[notebookId];
    if (!current?.follow) return null;
    const have = new Set(current.sources.map((source) => source.url).filter(Boolean));
    const room = sourceLimit - current.sources.length;
    const fresh = items
      .filter((item) => !have.has(item.url))
      .slice(0, Math.max(0, Math.min(perLook, room)));
    const at = Date.now();
    for (const item of fresh) {
      let address: string;
      try {
        address = new URL(item.url).href;
      } catch {
        continue;
      }
      if (have.has(address)) continue;
      void addLink(notebookId, address, item.title);
      const added = useTutorStore
        .getState()
        .notebooks[notebookId]?.sources.find((source) => source.url === address);
      if (added)
        useTutorStore.getState().updateSource(notebookId, added.id, {
          news: true,
          published: publishedAt(item.published, at),
          why: item.source,
        });
    }
    const after = useTutorStore.getState().notebooks[notebookId];
    if (after)
      for (const id of newsToDrop(after)) useTutorStore.getState().removeSource(notebookId, id);
    useTutorStore
      .getState()
      .updateNotebook(notebookId, (latest) =>
        latest.follow
          ? { ...latest, follow: { ...latest.follow, checkedAt: new Date(at).toISOString() } }
          : latest,
      );
    return null;
  } catch (reason) {
    return reason instanceof Error ? reason.message : String(reason);
  } finally {
    looking.delete(notebookId);
  }
}
