import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  EllipsisVertical,
  Newspaper,
  RefreshCw,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  IconButton,
  Input,
  MenuCheckItem,
  MenuItem,
  MenuSeparator,
  Surface,
  Text,
} from "@misty/ui";
import { lookForNews, setFollow } from "../notebook_follow";
import { useTutorStore } from "../tutor_store";
import type { Notebook } from "../tutor_types";

export function NotebookBar({
  notebook,
  onBack,
  onCustomize,
  onRebrief,
  onError,
  people,
}: {
  notebook: Notebook;
  people?: ReactNode;
  onBack(): void;
  onCustomize(): void;
  onRebrief(): void;
  onError(message: string): void;
}) {
  const [title, setTitle] = useState(notebook.title);
  useEffect(() => setTitle(notebook.title), [notebook.title]);
  const rename = () => {
    const next = title.trim();
    if (!next) return setTitle(notebook.title);
    if (next !== notebook.title)
      useTutorStore.getState().updateNotebook(notebook.id, (current) => ({
        ...current,
        title: next,
      }));
  };

  return (
    <Surface
      as="header"
      tone="sidebar"
      edge="hairline"
      className="flex min-h-13 flex-none items-center gap-1.5 border-0 border-b px-3 py-2"
    >
      <IconButton label="Back to the Lab" onClick={onBack}>
        <ArrowLeft />
      </IconButton>
      <Text bare size="title" className="leading-none" aria-hidden="true">
        {notebook.emoji ?? "📓"}
      </Text>
      <Input
        variant="title"
        className="mx-0 w-auto max-w-140 flex-1 px-1.5 text-title font-medium"
        aria-label="Notebook name"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={rename}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setTitle(notebook.title);
            event.currentTarget.blur();
          }
        }}
      />
      <div className="ml-auto flex items-center gap-1" data-tour="notebook-share">
        {people}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Notebook settings">
              <Settings2 />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" data-misty-layer-portal>
            <MenuItem icon={SlidersHorizontal} label="Customize notebook" onSelect={onCustomize} />
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton label="Notebook actions">
              <EllipsisVertical />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" data-misty-layer-portal>
            <MenuItem icon={RotateCcw} label="Write the overview again" onSelect={onRebrief} />
            <MenuSeparator />
            <MenuCheckItem
              icon={Newspaper}
              label="Follow the news"
              checked={Boolean(notebook.follow)}
              onCheckedChange={(next) => {
                setFollow(notebook.id, next ? { query: notebook.title } : undefined);
                if (next) void lookForNews(notebook.id).then((failed) => failed && onError(failed));
              }}
            />
            {notebook.follow && (
              <MenuItem
                icon={RefreshCw}
                label="Look for news now"
                onSelect={() =>
                  void lookForNews(notebook.id).then((failed) => failed && onError(failed))
                }
              />
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Surface>
  );
}
