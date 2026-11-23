# Plugging misty-lab into Misty

The Lab was cut out of Misty on 2026-11-22, together with the Code page (misty-code). This file is the
contract between them: what the Lab takes from Misty, what Misty kept for it, and how to put it back.

## 1. What misty-lab needs from Misty

The files keep Misty's paths, so their imports resolve once they are back in place:

- **Tutor and lessons**, which stayed: `tutor/cursor/*` and `tutor/lessons/*`.
- **Runs:** `conversations/start_run.ts` (moved there out of `tutor_runs.ts`, which re-exports it), `conversations/state/*`, `engines/default_engine`, `engines/engine_run`,
  `runs/invocations/*`, `plans/store`.
- **Spaces:** `spaces-gateway/spaces_gateway` (live docs, member pictures, places), `personal/*`, `now/*`.
- **Shared:** `@misty/ui`, `shared/lib/person_tone`, `features/settings`, `features/onboarding` tours.

## 2. What Misty kept on purpose

- **The Lab's host.** `features/spaces/apps/page_misty.ts` still builds the `lab` page's misty-sdk client and its
  rooms (`labRoomSource`, on Space notes' live collaboration), and `features/spaces/handoffs/live_gateway.ts`
  still opens a notebook's live doc through it.
- **Presence.** The `"lab"` place (`features/spaces/list/realtime_types.ts`, `spacesGateway`'s `PersonPlace`,
  `now/team_members.ts`, `ChatMemberList`'s "In the Lab") and misty-server's presence rooms.
- **Notebooks themselves** are Space notes on the server, so nothing a Space made is lost.
- **Search's `learn` kind**, now called Lessons.

## 3. Where Misty mounted it

`integration/misty.patch` turns those files back into what they were. The ones that only carried the Lab:

| Misty file | What it did there |
| --- | --- |
| `features/agents/methods/AgentWorkspaceFrame.tsx`, `page/use_agents_page_state.ts` | The `lab` workspace page and `?view=lab`, `tutor`, `notebooks` |
| `features/spaces/overview/SpaceSectionView.tsx`, `routes/space_route.ts`, `components/SpacePageLoadingPlaceholder.tsx` | The Space's `/lab` section and its skeleton |
| `features/app-windows/tabs/route_surface.ts` | Lab as a Space tool tab |
| `app/layouts/DesktopLayout/sidebar_pins_store.ts`, `SpaceNavigator.tsx` | Lab as a pinned place; chats the Lab made kept out of the list |
| `app/layouts/DesktopLayout/search/UseSearchHits.tsx`, `UseRemoteHits.tsx`, `search_types.ts` | Lab under Go to, notebooks and passages in search, the Lab search kind |
| `shared/shortcuts/registry.ts`, `features/spaces/components/SpacePageShortcuts.tsx` | The third Space section shortcut |
| `features/onboarding/tours/tours.ts`, `TourHost.tsx` | The Lab and notebook tours |
| `features/agents/index.ts` | `SpaceLab`, `SpaceLabSkeleton`, `LabDoing`, `notebookRoute`, `searchNotebooks`, `PersonAvatar`, the tutor store |
| `features/agents/BottomBarStatus.tsx`, `activity/use_space_runs.ts`, `tutor/cursor/tutor_handoff.ts` | Chats the Lab made kept out of unread, Space runs and agents' threads |
| `features/agents/tutor/cursor/CursorCompanionController.tsx` | Following the Lab's jobs (`followTutorJobs`) |

The patch also carries Code's hunks in seven files both used (`AgentWorkspaceFrame.tsx`,
`use_agents_page_state.ts`, `features/agents/index.ts`, `sidebar_pins_store.ts`, `SpaceNavigator.tsx`,
`UseSearchHits.tsx`, `tutor_handoff.ts`). Bringing the Lab back alone, drop Code's hunks there.

## 4. Plugging it back in

1. Clone misty-lab next to Misty.
2. Copy `src/` over Misty's `src/`.
3. `git apply ../misty-lab/integration/misty.patch` from Misty's root. It was written against Misty as of
   2026-11-22; where Misty has moved on, apply the hunks by hand using the table above.
4. Fix the tests that mention the Lab (they were updated or dropped when it left).
