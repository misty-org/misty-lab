import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Globe } from "lucide-react";
import {
  HomeSection,
  homeChipsClass,
  IconButton,
  Input,
  PlaceChip,
  Surface,
  Text,
} from "@misty/ui";
import { notebookTopics, startOf, topicOf } from "./notebook_topics";
import { jobTitle } from "./tutor_prompts";
import { startJob } from "./tutor_runs";
import { researchPrompt } from "./tutor_studio";
import { useTutorStore } from "./tutor_store";
import type { TutorActions } from "./TutorPage";

export function TopicStart({
  actions,
  onError,
}: {
  actions: TutorActions;
  onError(message: string): void;
}) {
  const [query, setQuery] = useState("");
  const [topicId, setTopicId] = useState<string>();
  const field = useRef<HTMLInputElement>(null);
  const topic = topicOf(topicId);

  const start = (text: string) => {
    const typed = text.trim();
    if (!typed) return;
    const plan = startOf(typed.replace(/^[^:]{1,40}:\s*$/, (whole) => whole.replace(/:\s*$/, "")));
    const store = useTutorStore.getState();
    const notebook = store.createNotebook(plan.title);
    store.updateNotebook(notebook.id, (current) => ({
      ...current,
      ...(topic ? { topic: topic.id, emoji: topic.emoji } : {}),
    }));
    setQuery("");
    actions.open(`notebook:${notebook.id}`);
    startJob({
      kind: "research",
      title: jobTitle("research", plan.research),
      agentId: actions.agentId,
      notebookId: notebook.id,
      prompt: researchPrompt(plan.research, [], topic?.focus),
    }).catch((reason: unknown) =>
      onError(reason instanceof Error ? reason.message : String(reason)),
    );
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    start(query);
  };

  const pick = (id: string, label: string) => {
    const next = id === topicId ? undefined : id;
    setTopicId(next);
    setQuery((current) => {
      const words = current.replace(/^[^:]{1,40}:\s*/, "");
      return next ? `${label}: ${words}` : words;
    });
    field.current?.focus();
  };

  return (
    <>
      <Surface
        as="form"
        tone="card"
        edge="field"
        radius="xl"
        className="flex items-center gap-1.5 p-1.5 pl-3.5"
        onSubmit={submit}
        aria-label="Start a notebook"
      >
        <Text bare tone="muted" className="inline-flex flex-none">
          <Globe aria-hidden="true" />
        </Text>
        <Input
          ref={field}
          variant="bare"
          className="h-9.5 flex-1 px-2"
          aria-label="What do you want to explore?"
          placeholder={topic?.placeholder ?? "What do you want to explore?"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <IconButton label="Start a notebook" type="submit" disabled={!query.trim()}>
          <ArrowRight />
        </IconButton>
      </Surface>
      <HomeSection title="Start from a topic">
        <div className={homeChipsClass} role="group" aria-label="Topics">
          {notebookTopics.map((item) => (
            <PlaceChip
              key={item.id}
              icon={item.icon}
              label={item.label}
              pressed={item.id === topicId}
              onClick={() => pick(item.id, item.label)}
            />
          ))}
        </div>
      </HomeSection>
    </>
  );
}
