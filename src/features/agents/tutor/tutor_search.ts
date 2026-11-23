import { notebookContext, passagesContext } from "./tutor_prompts";
import { useTutorStore } from "./tutor_store";
import type { Notebook } from "./tutor_types";

interface Passage {
  notebookId: string;
  kind: "source" | "note";
  itemId: string;
  title: string;
  text: string;
}

export interface SearchHit extends Passage {
  score: number;
}

const size = 1200;
const overlap = 200;
const perNotebook = 300;

export function passagesOf(text: string): string[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const out: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "));
      if (cut > size / 2) end = start + cut + 1;
    }
    out.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return out.filter(Boolean);
}

function notebookPassages(notebook: Notebook): Passage[] {
  const passages: Passage[] = [];
  for (const source of notebook.sources) {
    const text =
      source.text || source.summary || [source.title, source.url].filter(Boolean).join(" ");
    for (const part of passagesOf(text))
      passages.push({
        notebookId: notebook.id,
        kind: "source",
        itemId: source.id,
        title: source.title,
        text: part,
      });
  }
  for (const note of notebook.notes)
    for (const part of passagesOf(`${note.title}\n\n${note.body}`))
      passages.push({
        notebookId: notebook.id,
        kind: "note",
        itemId: note.id,
        title: note.title,
        text: part,
      });
  return passages.slice(0, perNotebook);
}

export function hashOf(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = (hash * 33) ^ text.charCodeAt(index);
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let left = 0;
  let right = 0;
  for (let index = 0; index < a.length && index < b.length; index++) {
    dot += a[index] * b[index];
    left += a[index] * a[index];
    right += b[index] * b[index];
  }
  return left && right ? dot / Math.sqrt(left * right) : 0;
}

function wordSearch(query: string, notebooks: Notebook[]): SearchHit[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 1);
  if (!words.length) return [];
  return notebooks
    .flatMap(notebookPassages)
    .map((passage) => {
      const text = passage.text.toLowerCase();
      const found = words.filter((word) => text.includes(word)).length;
      return { ...passage, score: found / words.length };
    })
    .filter((hit) => hit.score > 0);
}

export async function searchNotebooks(
  query: string,
  signal?: AbortSignal,
): Promise<{ hits: SearchHit[]; byMeaning: boolean }> {
  const all = Object.values(useTutorStore.getState().notebooks);
  const hits = wordSearch(query, all);
  signal?.throwIfAborted();
  const best = new Map<string, SearchHit>();
  for (const hit of hits.sort((a, b) => b.score - a.score)) {
    const key = `${hit.notebookId}:${hit.itemId}`;
    if (!best.has(key)) best.set(key, hit);
  }
  return { hits: [...best.values()].slice(0, 12), byMeaning: false };
}

const wholeLimit = 60_000;

export async function questionContext(notebook: Notebook, question: string): Promise<string> {
  const whole = notebookContext(notebook);
  if (whole.length <= wholeLimit) return whole;
  const included = {
    ...notebook,
    sources: notebook.sources.filter((source) => source.context !== "off"),
    notes: [],
  };
  const ranked = wordSearch(question, [included]);
  const top = ranked.sort((a, b) => b.score - a.score).slice(0, 12);
  return passagesContext(notebook, top);
}
