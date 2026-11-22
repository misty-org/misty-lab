import type { NotebookSource } from "../tutorTypes";

export function answerForNotes(
  answer: string,
  numbered: readonly string[] | undefined,
  sources: readonly NotebookSource[],
): string {
  return answer.replace(/\[(\d{1,3})\](?!\()/g, (whole, number: string) => {
    const index = Number(number) - 1;
    const id = numbered ? numbered[index] : sources[index]?.id;
    const source = sources.find((item) => item.id === id);
    if (!source) return whole;
    const title = source.title.replace(/[[\]]/g, "");
    return source.url ? `[${title}](${source.url})` : `(${title})`;
  });
}

export function mathMarkdown(text: string): string {
  return text
    .replace(/\\\[([\s\S]+?)\\\]/g, (_whole, math: string) => `$$${math.trim()}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_whole, math: string) => `$$${math.trim()}$$`);
}

export function citeLinks(answer: string, sources: number | readonly string[]): string {
  const count = typeof sources === "number" ? sources : sources.length;
  return mathMarkdown(answer).replace(/\[(\d{1,3})\](?!\()/g, (whole, number: string) => {
    const index = Number(number);
    if (index < 1 || index > count) return whole;
    return typeof sources === "number"
      ? `[[${index}]](#tutor-source-${index})`
      : `[[${index}]](#tutor-source-id-${sources[index - 1]})`;
  });
}
