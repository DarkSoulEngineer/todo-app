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
```

`npm start` then scan the QR code with Expo Go, or run a development build for
the native date picker.

## Architecture

```
app/                     expo-router routes
  _layout.tsx            providers + headerless stack
  index.tsx              board manager (projects)
  board/[id].tsx         workspace: Board / List / Calendar / Insights
src/
  components/            UI, organized by feature
  hooks/use-tasks.ts     task + project state, persistence orchestration
  lib/
    domain/              pure task/board/section/status rules
    features/            quick-add grammar, insights, board layout, card themes
    data/                workspace validation, sample data, AsyncStorage, import/export
    utils/               ids, dates, pluralize
  providers/             theme, tasks, toasts
  theme/tokens.ts        warm light / warm dark design tokens
```

Persistence is device-local via AsyncStorage. The web app's keys are reused
(`janus.projects.v1`, `janus.versions.v1`, theme under `janus.theme.v1`), so a
JSON export from either client can be imported by the other.

## Feature parity

Ported: board manager (create/rename/recolor/duplicate/delete/import/export),
per-board workspaces, board sections, task CRUD with subtasks, priorities,
boards (categories), due dates, quick-add parsing (`!high`, `#work`,
`tomorrow 5pm`, relative dates), search/sort/filter, list grouping, month
calendar, insights (7/30/90-day windows, streak, weekday/priority/board splits),
sample data, saved versions, JSON/CSV export.

Adapted for touch: drag-and-drop is replaced by explicit "move to section"
actions; the desktop window chrome/keyboard shortcuts are omitted.
