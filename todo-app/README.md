# Janus

<p align="center">
  <img src="public/icon-512.png" alt="Janus" width="320" />
</p>

**A focused task manager for the web.**

Janus keeps tasks, boards, schedules, and progress in one local-first workspace. It runs as a Next.js PWA with no account, backend, or required network connection.

## Features

- **Boards** for separate projects or workspaces
- **Task management** with descriptions, priorities, due dates, tags, subtasks, and undo
- **Quick add** for entries such as `Prepare report tomorrow 5pm !high #work`
- **Board, list, and calendar views** with drag and drop
- **Custom sections** alongside Upcoming, Overdue, Completed, and Canceled statuses
- **Insights** with completion trends, streaks, status totals, priority breakdowns, and CSV export
- **Local persistence** through `localStorage`
- **JSON backup and restore** for tasks, boards, and sections
- **Light and dark themes**, keyboard shortcuts, responsive layout, and reduced-motion support
- **Installable offline PWA** with accessible keyboard and screen-reader interactions

## Stack

- Next.js 16 with the App Router
- React 19 and TypeScript
- Tailwind CSS 4
- `@dnd-kit` for drag and drop
- Framer Motion for transitions
- `date-fns` for date handling
- `next-themes` and Sonner

## Requirements

- Node.js 20.9 or newer
- npm
- A current Chromium, Firefox, or Safari browser

## Installation

```bash
git clone https://github.com/DarkSoulEngineer/todo-app.git
cd todo-app
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Production

```bash
npm run build
npm run start
```

## Project structure

```text
todo-app/
├── public/                 # PWA assets, icons, and service worker
├── src/
│   ├── app/                # Next.js entry points
│   ├── components/         # Board, calendar, list, task, and UI components
│   └── lib/
│       ├── data/           # Local storage and workspace data
│       ├── domain/         # Task, board, section, and status rules
│       ├── features/       # Quick add and insights logic
│       └── utils/           # Shared utilities
├── package.json
├── next.config.ts
└── tsconfig.json
```

## Data and privacy

Janus stores workspace data in the browser that runs it. There is no sign-in or server-side data store. Use the JSON export in the data menu to move a workspace to another browser or create a backup.

## License

No license has been selected yet.
