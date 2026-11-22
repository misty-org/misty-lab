import type { Notebook, NotebookNote, NotebookSource } from "./tutorTypes";

export const NOTEBOOK_DOC_PREFIX = "Notebook: ";
const SPACE_NOTES_HEADING = "## Space notes";
const SPACE_NOTES_HINT =
  "_Anyone here can add to this section. It stays when the notebook updates._";
const note = (text: string) => text.replace(/\r\n/g, "\n").trim();

export function spaceNotesOf(markdown: string): string {
  const text = markdown.replace(/\r\n/g, "\n");
  const at = text.lastIndexOf(`\n${SPACE_NOTES_HEADING}\n`);
  const start = text.startsWith(`${SPACE_NOTES_HEADING}\n`) ? 0 : at < 0 ? -1 : at + 1;
  if (start < 0) return "";
  return text
    .slice(start + SPACE_NOTES_HEADING.length)
    .replace(SPACE_NOTES_HINT, "")
    .trim();
}

export function notebookMarkdown(notebook: Notebook): string {
  const parts = ["_A Lab notebook. Open it in the Lab to work in it with everyone here._"];
  if (notebook.brief?.summary) {
    parts.push("## Overview", note(notebook.brief.summary));
    if (notebook.brief.topics.length) parts.push(`**Topics:** ${notebook.brief.topics.join(", ")}`);
    if (notebook.brief.questions.length)
      parts.push(
        "## Questions to explore",
        notebook.brief.questions.map((q) => `- ${q}`).join("\n"),
      );
  }
  const sources = notebook.sources.filter((source) => source.context !== "off" || source.url);
  if (sources.length) parts.push("## Sources", sources.map(sourceLine).join("\n"));
  if (notebook.notes.length) {
    parts.push("## Notes");
    for (const item of notebook.notes) parts.push(`### ${item.title || "Note"}`, note(item.body));
  }
  return parts.join("\n\n") + "\n";
}

function sourceLine(source: NotebookSource): string {
  const title = source.title.replace(/[[\]]/g, "") || "Source";
  const about = source.summary ? `: ${oneLine(source.summary)}` : "";
  return source.url ? `- [${title}](${source.url})${about}` : `- ${title}${about}`;
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

export function notebookFromMarkdown(markdown: string): {
  sources: Pick<NotebookSource, "kind" | "title" | "url" | "text">[];
  notes: Pick<NotebookNote, "title" | "body">[];
} {
  const sections = new Map<string, string>();
  let heading = "";
  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const top = /^## (.+)$/.exec(line);
    if (top) {
      heading = top[1]!.trim();
      sections.set(heading, "");
      continue;
    }
    if (heading) sections.set(heading, `${sections.get(heading)}${line}\n`);
  }
  const sources: Pick<NotebookSource, "kind" | "title" | "url" | "text">[] = [];
  for (const line of (sections.get("Sources") ?? "").split("\n")) {
    const link = /^- \[([^\]]*)\]\((https?:\/\/[^)\s]+)\)(?::\s*(.*))?$/.exec(line.trim());
    if (link) {
      sources.push({ kind: "link", title: link[1] || link[2]!, url: link[2] });
      continue;
    }
    const plain = /^- ([^:]+)(?::\s*(.*))?$/.exec(line.trim());
    if (plain?.[2]) sources.push({ kind: "text", title: plain[1]!.trim(), text: plain[2] });
  }
  const notes: Pick<NotebookNote, "title" | "body">[] = [];
  const overview = sections.get("Overview")?.trim();
  if (overview) notes.push({ title: "Overview", body: overview });
  for (const block of (sections.get("Notes") ?? "").split(/^### /m).slice(1)) {
    const [title = "", ...body] = block.split("\n");
    notes.push({ title: title.trim() || "Note", body: body.join("\n").trim() });
  }
  const fromSpace = spaceNotesOf(markdown);
  if (fromSpace) notes.push({ title: "Space notes", body: fromSpace });
  return { sources, notes };
}
