import { useEffect, useState } from "react";
import { FileText, StickyNote } from "lucide-react";
import { Pressable, SearchField, Skeleton, OverflowFadeText, Surface, Text } from "@misty/ui";
import type { TutorActions } from "./TutorPage";
import { searchNotebooks, type SearchHit } from "./tutorSearch";
import { useTutorStore } from "./tutorStore";

export interface NotebookSearch {
  query: string;
  setQuery(value: string): void;
  searching: boolean;
  result?: { hits: SearchHit[]; byMeaning: boolean };
}

export function useNotebookSearch(): NotebookSearch {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<NotebookSearch["result"]>();
  const searching = query.trim().length >= 3;
  useEffect(() => {
    const text = query.trim();
    if (text.length < 3) {
      setResult(undefined);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchNotebooks(text, controller.signal)
        .then(setResult)
        .catch(() => !controller.signal.aborted && setResult({ hits: [], byMeaning: true }));
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return { query, setQuery, searching, result };
}

export function SearchAll({ search }: { search: NotebookSearch }) {
  return (
    <SearchField
      containerClassName="w-56"
      aria-label="Search notebooks"
      placeholder="Search notebooks"
      value={search.query}
      onChange={(event) => search.setQuery(event.target.value)}
    />
  );
}

export function NotebookSearchResults({
  search,
  actions,
}: {
  search: NotebookSearch;
  actions: TutorActions;
}) {
  const notebooks = useTutorStore((state) => state.notebooks);
  const result = search.result;
  if (!result) {
    return (
      <div className="flex flex-col gap-0.5" aria-busy="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col items-stretch gap-1 px-2.5 py-2" aria-hidden>
            <span className="flex min-w-0 items-center gap-2">
              <Skeleton className="size-4 shrink-0 rounded-sm" />
              <span className="flex h-4.5 items-center">
                <Skeleton className={index % 2 ? "h-3 w-32" : "h-3 w-44"} />
              </span>
              <Skeleton className="h-2.5 w-20 shrink-0" />
            </span>
            <span className="grid">
              <span className="flex h-4 items-center">
                <Skeleton className="h-2.5 w-full" />
              </span>
              <span className="flex h-4 items-center">
                <Skeleton className="h-2.5 w-3/4" />
              </span>
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (!result.hits.length) {
    return (
      <Text as="p" size="meta" tone="muted" wrap className="py-6 text-center">
        Nothing found.
      </Text>
    );
  }
  return (
    <div className="flex flex-col gap-0.5" role="list" aria-label="Results">
      {result.hits.map((hit) => (
        <Surface
          as={Pressable}
          key={`${hit.notebookId}:${hit.itemId}`}
          tone="none"
          radius="lg"
          wash="control"
          role="listitem"
          className="flex flex-col items-stretch gap-1 px-2.5 py-2 text-left"
          onClick={() => actions.open(`notebook:${hit.notebookId}`)}
        >
          <Text bare size="meta" tone="default" className="flex min-w-0 items-center gap-2">
            <Text bare tone="muted" className="flex flex-none">
              {hit.kind === "note" ? <StickyNote /> : <FileText />}
            </Text>
            <OverflowFadeText>{hit.title}</OverflowFadeText>
            <Text size="caption" tone="muted" className="flex-none">
              {notebooks[hit.notebookId]?.title}
            </Text>
          </Text>
          <Text size="caption" tone="muted" lines={2}>
            {hit.text.slice(0, 220)}
          </Text>
        </Surface>
      ))}
    </div>
  );
}
