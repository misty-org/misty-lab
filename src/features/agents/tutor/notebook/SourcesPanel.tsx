import { useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  FileText,
  Globe,
  Link2,
  MessageSquareQuote,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  StickyNote,
  Type,
  X,
} from "lucide-react";
import {
  Button,
  Checkbox,
  EmptyState,
  IconButton,
  Input,
  Pressable,
  OverflowFadeText,
  Surface,
  Text,
} from "@misty/ui";
import { jobTitle } from "../tutorPrompts";
import { dismissJob, retryJob, startJob, unusableReply } from "../tutorRuns";
import { researchPrompt } from "../tutorStudio";
import { useTutorStore } from "../tutorStore";
import type { Notebook, NotebookSource, TutorJob } from "../tutorTypes";
import { paneClass, paneHeadClass, paneScrollClass, railClass } from "./panes";
import type { NotebookAgent } from "../notebookAgents";
import type { Person } from "../notebookPresence";
import { useArrived } from "./useArrived";
import { PaneFaces, RowFaces } from "./LivePeople";

export type Opened = { kind: "source" | "note"; id: string };

function sourceIcon(source: NotebookSource) {
  if (source.kind === "recording") return <Mic />;
  if (source.kind === "text") return <Type />;
  if (source.kind === "file") return <FileText />;
  const host = source.url ? new URL(source.url).hostname : "";
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return <Play />;
  return <Link2 />;
}

const rowClass = "flex items-center gap-1.5 py-0.5 pr-2.5 pl-0.5";

function SourceLabel({
  icon,
  off,
  reading,
  children,
}: {
  icon: ReactNode;
  off?: boolean;
  reading?: boolean;
  children: ReactNode;
}) {
  return (
    <Text
      bare
      size="meta"
      tone={off ? "muted" : "default"}
      className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-2 text-left"
    >
      <Text bare tone="muted" className="inline-flex flex-none">
        {icon}
      </Text>
      {typeof children === "string" ? (
        <OverflowFadeText className={reading ? "misty-shimmer" : undefined}>
          {children}
        </OverflowFadeText>
      ) : (
        children
      )}
    </Text>
  );
}

const searchTopic = (job: TutorJob) => job.title.replace(/^Finding sources:\s*/, "");

export function SourcesPanel({
  notebook,
  agentId,
  collapsed,
  opened,
  onCollapse,
  onAdd,
  onOpen,
  onNewNote,
  onError,
  people = [],
  agents = [],
}: {
  notebook: Notebook;
  agentId: string;
  collapsed: boolean;
  opened?: Opened;
  onCollapse(collapsed: boolean): void;
  onAdd(): void;
  onOpen(item: Opened): void;
  onNewNote(): void;
  onError(message: string): void;
  people?: Person[];
  agents?: NotebookAgent[];
}) {
  const spaceId = notebook.space?.spaceId;
  const fresh = useArrived(notebook);
  const store = useTutorStore.getState();
  const jobs = useTutorStore((state) => state.jobs);
  const [query, setQuery] = useState("");
  const searches = Object.values(jobs).filter(
    (job) => job.notebookId === notebook.id && job.kind === "research",
  );
  const researching = searches.filter((job) => job.state === "queued" || job.state === "running");
  const failed = searches.filter((job) => job.state === "failed");
  const empty = !notebook.sources.length && !researching.length && !failed.length;
  const included = notebook.sources.filter((source) => source.context !== "off").length;
  const all = notebook.sources.length > 0 && included === notebook.sources.length;

  const research = (event?: FormEvent) => {
    event?.preventDefault();
    const topic = query.trim();
    if (!topic) return;
    setQuery("");
    const have = notebook.sources.flatMap((source) => (source.url ? [source.url] : []));
    void startJob({
      kind: "research",
      title: jobTitle("research", topic),
      agentId,
      notebookId: notebook.id,
      prompt: researchPrompt(topic, have),
    }).catch((reason: unknown) => onError(String(reason)));
  };
  const setAll = (on: boolean) =>
    store.updateNotebook(notebook.id, (current) => ({
      ...current,
      sources: current.sources.map((source) => ({
        ...source,
        context: on ? (source.context === "off" ? "full" : source.context) : "off",
      })),
    }));

  if (collapsed)
    return (
      <Surface
        as="aside"
        tone="sidebar"
        edge="hairline"
        className={`${railClass} border-0 border-r`}
        aria-label="Sources"
      >
        <IconButton label="Show sources" onClick={() => onCollapse(false)}>
          <PanelLeftOpen />
        </IconButton>
        <IconButton label="Add sources" onClick={onAdd}>
          <Plus />
        </IconButton>
      </Surface>
    );

  return (
    <Surface
      as="aside"
      tone="sidebar"
      edge="hairline"
      className={`${paneClass} tutor-sources-pane border-0 border-r`}
      aria-label="Sources"
      data-tour="notebook-sources"
      data-live-pane="sources"
    >
      <header className={paneHeadClass}>
        <Text as="h2" size="control" weight="medium" tone="bright" className="ml-1 flex-1">
          Sources
        </Text>
        <PaneFaces spaceId={spaceId} people={people} agents={agents} pane="sources" />
        <IconButton label="Hide sources" onClick={() => onCollapse(true)}>
          <PanelLeftClose />
        </IconButton>
      </header>
      <div
        className="flex flex-wrap gap-2 px-3 pt-1 pb-2.5 *:min-w-max *:flex-1"
        data-tour="notebook-add"
      >
        {empty ? null : (
          <Button onClick={onAdd} icon={Plus}>
            Sources
          </Button>
        )}
        <Button onClick={onNewNote} icon={Plus}>
          Note
        </Button>
      </div>
      <Surface
        as="form"
        tone="page"
        edge="field"
        radius="xl"
        className="mx-3 mb-2.5 flex items-center gap-1.5 py-1 pr-1 pl-3"
        onSubmit={research}
      >
        <Text bare tone="muted" className="inline-flex flex-none">
          <Globe aria-hidden="true" />
        </Text>
        <Input
          variant="bare"
          className="h-8 flex-1 px-2"
          aria-label="Search the web for new sources"
          placeholder="Search the web for new sources"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <IconButton label="Find sources" type="submit" disabled={!query.trim()}>
          <ArrowRight />
        </IconButton>
      </Surface>

      <div className={paneScrollClass}>
        {researching.map((job) => (
          <Surface
            key={job.id}
            tone="none"
            radius="lg"
            wash="control"
            className={rowClass}
            aria-busy="true"
          >
            <Text bare tone="muted" className="inline-flex flex-none">
              <Globe />
            </Text>
            <OverflowFadeText className="misty-shimmer">
              {job.state === "queued" ? "Waiting to search the web" : "Searching the web"}
            </OverflowFadeText>
          </Surface>
        ))}
        {failed.map((job) => (
          <Surface
            key={job.id}
            tone="none"
            radius="lg"
            wash="control"
            className={rowClass}
            role="alert"
          >
            <SourceLabel icon={<Globe aria-hidden="true" />}>
              <Text tone="danger" full>
                {job.error && job.error !== unusableReply
                  ? job.error
                  : `Couldn’t find sources for “${searchTopic(job)}”`}
              </Text>
            </SourceLabel>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => void retryJob(job).catch((reason: unknown) => onError(String(reason)))}
            >
              Try again
            </Button>
            <IconButton label="Dismiss" size="sm" onClick={() => void dismissJob(job)}>
              <X />
            </IconButton>
          </Surface>
        ))}
        {notebook.sources.length ? (
          <Text
            as="label"
            bare
            size="caption"
            tone="muted"
            className="flex cursor-pointer items-center justify-between py-1.5 pr-2.5 pl-2"
          >
            <span>Select all</span>
            <Checkbox checked={all} onCheckedChange={(on) => setAll(on === true)} />
          </Text>
        ) : null}
        {notebook.sources.map((source) => {
          const open = opened?.kind === "source" && opened.id === source.id;
          return (
            <Surface
              key={source.id}
              tone="none"
              radius="lg"
              wash="control"
              hovered={open || fresh.has(source.id)}
              className={rowClass}
              data-open={open ? "true" : undefined}
              data-off={source.context === "off" ? "true" : undefined}
              data-live-anchor={source.id}
            >
              <Pressable
                className="flex min-w-0 flex-1"
                onClick={() => onOpen({ kind: "source", id: source.id })}
              >
                <SourceLabel
                  icon={sourceIcon(source)}
                  off={source.context === "off"}
                  reading={source.reading}
                >
                  {source.title}
                </SourceLabel>
              </Pressable>
              <RowFaces spaceId={spaceId} people={people} agents={agents} itemId={source.id} />
              <Checkbox
                aria-label={`Use ${source.title}`}
                checked={source.context !== "off"}
                onCheckedChange={(on) =>
                  store.updateSource(notebook.id, source.id, {
                    context: on === true ? "full" : "off",
                  })
                }
              />
            </Surface>
          );
        })}
        {notebook.notes.length ? (
          <Text as="p" size="caption" tone="muted" className="mx-2 mt-3 mb-1">
            Notes
          </Text>
        ) : null}
        {notebook.notes.map((note) => {
          const open = opened?.kind === "note" && opened.id === note.id;
          return (
            <Surface
              key={note.id}
              as={Pressable}
              tone="none"
              radius="lg"
              wash="control"
              hovered={open || fresh.has(note.id)}
              className="flex min-w-0 flex-1 items-center text-left"
              data-open={open ? "true" : undefined}
              data-live-anchor={note.id}
              onClick={() => onOpen({ kind: "note", id: note.id })}
            >
              <SourceLabel icon={note.fromQuestion ? <MessageSquareQuote /> : <StickyNote />}>
                {note.title || "Untitled note"}
              </SourceLabel>
              <RowFaces spaceId={spaceId} people={people} itemId={note.id} />
            </Surface>
          );
        })}
        {empty ? (
          <EmptyState
            inline
            title="No sources yet"
            line="Add web pages, files or notes, or search the web for them."
            action={{ label: "Add sources", icon: Plus, onClick: onAdd, variant: "secondary" }}
          />
        ) : null}
      </div>
    </Surface>
  );
}
