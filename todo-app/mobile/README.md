# Janus — mobile

Expo (React Native) port of the Janus task app. The Next.js app remains at the
repository root; this directory is the native client.

## Run

```bash
cd mobile
npm install
npm start          # Expo dev server (press a / i / w)
npm run android
npm run ios
npm run typecheck
npm run lint
```

`npm start` then scan the QR code with Expo Go, or run a development build for
the native date picker.

## Architecture

```
app/                     expo-router routes
  _layout.tsx            providers + headerless stack
  index.tsx              Home / board manager
  my-tasks.tsx           cross-board task overview
  calendar.tsx           cross-board calendar overview
  settings.tsx           app-level settings
  board/[id].tsx         board workspace: Board / List / Calendar / Insights
  task/new.tsx           task creation route
  task/[id].tsx          task inspector route
src/
  components/
    board/               ribbon, columns, cards, board manager UI
    reference/mobile/    shared top-level screens and UI primitives
    ui/                  shared top bar, sheets, inputs, atmosphere
  hooks/
    use-tasks.ts         task + project state, persistence orchestration
    use-all-board-tasks.ts  open-board aggregation for My Tasks and Calendar
  lib/
    domain/              pure task/board/list/status rules
    features/            quick-add grammar, insights, board layout, card themes
    data/                workspace validation, sample data, AsyncStorage, import/export
    utils/               ids, dates, pluralize
  providers/             theme, tasks, preferences, toasts
  theme/tokens.ts        warm light / warm dark design tokens
```

Persistence is device-local via AsyncStorage. The web app's keys are reused
(`janus.projects.v1`, `janus.versions.v1`, theme under `janus.theme.v1`), so a
JSON export from either client can be imported by the other.

## Navigation

The mobile app uses a shared ribbon top bar and a four-tab bottom navigation:

| Tab | Route | Purpose |
|---|---|---|
| Home | `app/index.tsx` | Board manager with open/closed boards, import, create, and rearrange. |
| My Tasks | `app/my-tasks.tsx` | Tasks from every open board; tapping a task opens its owning board. |
| Calendar | `app/calendar.tsx` | Calendar across every open board, with month/week modes and Today. |
| Settings | `app/settings.tsx` | App-level appearance, calendar defaults, data/backups, and About. |

Board-specific work stays in `app/board/[id].tsx` and keeps its own
Board / List / Calendar / Insights ribbon. My Tasks and Calendar are overviews
only; task creation stays in Home and board views.

All four top-level screens share the ribbon top-bar/search styling, content
width, page padding, and bottom-nav clearance from `src/theme/layout.ts`.
Interacting with a ribbon control resets its auto-hide timer.

## Lists and cancellation

- Board columns are called **lists** in the UI. The domain type remains
  `BoardSection`, so code and persisted data still use `sections`/`sectionId`.
- Lists can be added, renamed, hidden, reordered, and deleted from their menu.
  Deleting a list keeps its cards; they move to Unsorted or a matching status
  list. Confirmation uses an in-app sheet because `Alert.alert` is a no-op on
  react-native-web.
- Canceling a card creates or reuses a custom **Canceled** list, unhides it if
  needed, and moves the card into it. Restoring a card moves it out again.
- Editing an existing card auto-saves and closes with the X button; new cards use
  the **Add task** button.
- The app is local and single-user. It has no assignees, avatars, user names,
  emails, or multiuser identity fields.

## Implemented features

Board manager (create/rename/recolor/duplicate/delete/import/export), open and
closed boards, per-board workspaces, custom lists, task CRUD with subtasks,
priorities, board tags/categories, due dates, quick-add parsing (`!high`,
`#work`, `tomorrow 5pm`, relative dates), search/sort/filter, bulk actions,
list grouping, calendar views, insights (7/30/90-day windows, streak,
weekday/priority/board splits), sample data, saved versions, local single-user
preferences, and JSON/CSV export.

Adapted for touch: drag-and-drop is replaced by explicit move actions; the
desktop window chrome/keyboard shortcuts are omitted.
