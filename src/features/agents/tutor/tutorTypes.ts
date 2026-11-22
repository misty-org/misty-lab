export type SourceContext = "off" | "summary" | "full";

export type SourceKind = "text" | "link" | "file" | "recording";

export interface NotebookSource {
  id: string;
  kind: SourceKind;
  title: string;
  url?: string;
  text?: string;
  mimeType?: string;
  summary?: string;
  context: SourceContext;
  truncated?: boolean;
  reading?: boolean;
  titled?: boolean;
  why?: string;
  news?: boolean;
  published?: string;
  addedBy?: string;
  agent?: { id: string; name: string };
  createdAt: string;
}

export interface NotebookNote {
  id: string;
  title: string;
  body: string;
  origin: "person" | "agent";
  transformation?: string;
  sourceId?: string;
  authorId?: string;
  agent?: { id: string; name: string };
  fromQuestion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transformation {
  id: string;
  title: string;
  prompt: string;
}

export interface NotebookChatStyle {
  goal: "default" | "guide" | "custom";
  custom?: string;
  length: "default" | "shorter" | "longer";
}

export interface NotebookFollow {
  query: string;
  checkedAt?: string;
}

export interface Notebook {
  id: string;
  title: string;
  topic?: string;
  follow?: NotebookFollow;
  sources: NotebookSource[];
  notes: NotebookNote[];
  transformations: Transformation[];
  chats: string[];
  thread?: { conversationId: string; questions: string[]; cites?: string[][] };
  emoji?: string;
  space?: { spaceId: string; docId: string };
  discussionId?: string;
  createdBy?: string;
  shared?: { spaceId: string; spaceName: string; docId: string; sharedAt: string };
  savedFrom?: { spaceId: string; docId: string };
  chatStyle?: NotebookChatStyle;
  brief?: {
    summary: string;
    topics: string[];
    questions: string[];
    sources: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CardReview {
  due: string;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  reviewedAt?: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  review: CardReview;
}

export interface Deck {
  id: string;
  title: string;
  cards: Flashcard[];
  notebookId?: string;
  conversationId?: string;
  by?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestion {
  question: string;
  choices: string[];
  answer: number;
  explanation?: string;
}

export interface OverviewLine {
  speaker: 0 | 1;
  text: string;
}

export interface MindNode {
  label: string;
  children?: MindNode[];
}

export interface VideoScene {
  svg?: string;
  heading: string;
  points?: string[];
  narration: string;
  seconds?: number;
}

export interface Guide {
  id: string;
  kind: "guide" | "quiz" | "overview" | "mindmap" | "slides" | "infographic" | "video";
  report?: string;
  map?: MindNode;
  scenes?: VideoScene[];
  title: string;
  body: string;
  questions?: QuizQuestion[];
  lastScore?: number;
  script?: OverviewLine[];
  audio?: { state: "making" | "ready" | "failed"; seconds?: number; error?: string };
  notebookId?: string;
  conversationId?: string;
  by?: string;
  createdAt: string;
  updatedAt: string;
}

export type TutorJobKind =
  | "guide"
  | "deck"
  | "quiz"
  | "overview"
  | "mindmap"
  | "slides"
  | "infographic"
  | "video"
  | "research"
  | "brief"
  | "note"
  | "summary";

export interface TutorJob {
  id: string;
  kind: TutorJobKind;
  title: string;
  agentId: string;
  conversationId?: string;
  runId?: string;
  prompt: string;
  notebookId?: string;
  sourceId?: string;
  transformation?: string;
  report?: string;
  state: "queued" | "running" | "done" | "failed";
  error?: string;
  restarts?: number;
  resultId?: string;
  createdAt: string;
  updatedAt: string;
}
