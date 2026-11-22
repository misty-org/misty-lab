import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { StudioPage, StudioPageScroll } from "../methods/StudioPage";
import { useAgentAccountId } from "../personal/agentAccount";
import { homeSpaceOf } from "../personal/agentHomeSpace";
import { listSpaceNotebooks, useNotebooksInSpace } from "./notebookSpace";
import { useLessonStore } from "./lessons/lessonStore";
import { NotebookWorkspace } from "./notebook/NotebookWorkspace";
import { DeckView, ReviewSession } from "./TutorDecks";
import { GuideView, OverviewView, QuizView } from "./TutorGuides";
import { MindMapView, SlidesView } from "./notebook/StudioViews";
import { InfographicView, VideoView } from "./notebook/VideoView";
import { TutorHome } from "./TutorHome";
import { useTutorStore } from "./tutorStore";

export interface TutorActions {
  agentId: string;
  spaceId: string;
  onChat(agentId: string, conversationId: string): void;
  onLearn(prompt: string): void;
  open(item: string): void;
}

export function TutorPage({
  agentId,
  agentSpaceId,
  onLesson,
  onLearn,
}: {
  agentId: string;
  agentSpaceId?: string;
  onLesson(agentId: string, conversationId: string): void;
  onLearn(prompt: string): void;
}) {
  const accountId = useAgentAccountId();
  const spaceId = homeSpaceOf(accountId, { space_id: agentSpaceId ?? "" });
  useNotebooksInSpace(spaceId || undefined);
  const [params, setParams] = useSearchParams();
  const item = params.get("item") ?? "";
  const notebooks = useTutorStore((state) => state.notebooks);
  const decks = useTutorStore((state) => state.decks);
  const guides = useTutorStore((state) => state.guides);
  useEffect(() => {
    void useLessonStore.getState().load(accountId);
    void useTutorStore.getState().load(accountId);
  }, [accountId]);

  const actions: TutorActions = useMemo(
    () => ({
      agentId,
      spaceId,
      onChat: onLesson,
      onLearn,
      open(next) {
        setParams((current) => {
          const updated = new URLSearchParams(current);
          if (next) updated.set("item", next);
          else updated.delete("item");
          return updated;
        });
      },
    }),
    [agentId, spaceId, onLesson, onLearn, setParams],
  );

  const docParam = params.get("doc");
  const spaceParam = params.get("space");
  const ready = useTutorStore((state) => state.ready);
  useEffect(() => {
    if (!docParam || !ready) return;
    const listIn = spaceParam ?? spaceId;
    const find = () =>
      Object.values(useTutorStore.getState().notebooks).find(
        (candidate) => candidate.space?.docId === docParam,
      );
    const show = () => {
      const found = find();
      setParams((current) => {
        const updated = new URLSearchParams(current);
        updated.delete("doc");
        updated.delete("space");
        if (found) updated.set("item", `notebook:${found.id}`);
        return updated;
      });
    };
    if (find() || !listIn) return show();
    void listSpaceNotebooks(listIn)
      .catch(() => undefined)
      .then(show);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docParam, spaceParam, ready]);

  const notebook = item.startsWith("notebook:")
    ? notebooks[item.slice("notebook:".length)]
    : undefined;
  if (notebook)
    return (
      <StudioPage>
        <NotebookWorkspace key={notebook.id} notebook={notebook} actions={actions} />
      </StudioPage>
    );

  if (!item.startsWith("made:"))
    return (
      <StudioPage>
        <TutorHome actions={actions} />
      </StudioPage>
    );
  return (
    <StudioPage>
      <StudioPageScroll>
        <div className="mx-auto flex w-full max-w-220 flex-col gap-7 px-6 pt-7 pb-10">
          <Made id={item.slice("made:".length)} actions={actions} decks={decks} guides={guides} />
        </div>
      </StudioPageScroll>
    </StudioPage>
  );
}

function Made({
  id,
  actions,
  decks,
  guides,
}: {
  id: string;
  actions: TutorActions;
  decks: ReturnType<typeof useTutorStore.getState>["decks"];
  guides: ReturnType<typeof useTutorStore.getState>["guides"];
}) {
  const home = () => actions.open("");
  const deck = decks[id.replace(/^review:/, "")];
  if (deck)
    return id.startsWith("review:") ? (
      <ReviewSession decks={[deck]} onDone={() => actions.open(`made:${deck.id}`)} />
    ) : (
      <DeckView
        deck={deck}
        onClose={home}
        onReview={() => actions.open(`made:review:${deck.id}`)}
      />
    );
  const guide = guides[id];
  if (!guide) return null;
  if (guide.kind === "quiz") return <QuizView quiz={guide} onClose={home} />;
  if (guide.kind === "overview") return <OverviewView overview={guide} onClose={home} />;
  if (guide.kind === "mindmap") return <MindMapView map={guide} onClose={home} />;
  if (guide.kind === "slides") return <SlidesView deck={guide} onClose={home} />;
  if (guide.kind === "video") return <VideoView video={guide} onClose={home} />;
  if (guide.kind === "infographic") return <InfographicView infographic={guide} onClose={home} />;
  return <GuideView guide={guide} actions={actions} onClose={home} />;
}
