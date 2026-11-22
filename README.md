# misty-lab

Misty's Lab, set aside as its own module.

[Misty](https://github.com/misty-org/misty) is a desktop app where your AI agents work in Spaces. The Lab was
where a Space learned: notebooks of sources (files, links, notes) to ask questions about with answers that cite
them, study tools made from a notebook (summaries, mind maps, flashcards, quizzes, decks, audio and video
overviews), guides and lessons by topic, and notebooks a Space's people read and add to together.

Misty no longer ships the Lab, so its beta can focus on the rest. Everything the Lab needed lives here, ready to
plug back in. Tutor, the cursor companion, and lessons in a chat stay in Misty.

## What's inside

| Folder | What it is |
| --- | --- |
| `src/features/agents/tutor/` | The Lab page (`SpaceLab.tsx`, `TutorPage.tsx`, `TutorHome.tsx`), topics, guides, decks and lessons lists, notebook search, the runs that make study tools (`tutorRuns.ts`, `tutorStudio.ts`, `tutorPrompts.ts`, `tutorAudio.ts`), its store, sources, spaced review and notebooks' live presence |
| `src/features/agents/tutor/notebook/` | A notebook: sources, reader, chat, studio panel and views, video export, people in it |
| `integration/misty.patch` | The changes in Misty that took the Lab out, reversed |

The folders mirror Misty's own, so a file here goes back to the same path in Misty.

## Using it

misty-lab isn't an app on its own. It runs inside Misty and reaches into it through Misty's `@/…` and relative
imports. [HOST.md](HOST.md) lists what it needs from Misty and how to plug it back in.

## License

AGPL-3.0-or-later, like Misty. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
