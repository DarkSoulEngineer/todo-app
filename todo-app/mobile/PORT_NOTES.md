# Janus mobile — UI contract

The Expo app lives in `mobile/`. The domain layer, persistence and providers are
already ported from the web app at the repository root. UI work must build on
them instead of re-implementing storage or task rules.

## Stack

- Expo SDK 58, React Native 0.88, React 19.3, expo-router 58
- TypeScript strict, path alias `@/*` → `mobile/src/*`
- `@expo/vector-icons` (Ionicons), `date-fns`, `expo-haptics`,
  `expo-linear-gradient`, `react-native-svg`, `@react-native-community/datetimepicker`
- No Tailwind. Use `StyleSheet` + theme tokens.

## Already implemented (do not rewrite)

### Theme

```ts
import { useTheme } from "@/providers/theme-provider";

const { theme, preference, setPreference, toggle } = useTheme();
theme.scheme;            // "light" | "dark"
theme.colors             // background, backgroundAlt, card, cardElevated, foreground,
                         // mutedForeground, border, borderStrong, input, primary,
                         // primaryForeground, primarySoft, secondary, secondaryForeground,
                         // accent, accentForeground, destructive, destructiveSoft, success,
                         // successSoft, warning, warningSoft, info, infoSoft, overlay, shadow, skeleton
theme.radius             // sm 8, md 12, lg 16, xl 22, pill 999
theme.space(4)           // 16
theme.type               // display, title, subtitle, body, bodyStrong, caption, micro
```

`src/theme/tokens.ts` may be tuned for visual quality, but keep every key.

### Tasks state

```ts
import { useTasksContext } from "@/providers/tasks-provider";

const {
  tasks, sections, boards, projects, currentProjectId, currentProjectName,
  isLoading, isEmpty,
  addTask, updateTask, patchTask, deleteTask,
  toggleComplete, toggleCancel, toggleSubtask, addSubtask, removeSubtask,
  setTaskStatus, setTaskDueAt, assignTaskToSection, setTaskSectionId,
  addSection, renameSection, deleteSection, toggleSectionHidden,
  createBoard, renameBoard, recolorBoard, deleteBoard, restoreBuiltInBoards,
  clearCompleted, getCompletedIds, snapshot, restore,
  versions, createVersion, restoreVersion, deleteVersion,
  loadSample,
  createProject, importProject, duplicateProject, renameProject,
  switchProject, removeProject,
} = useTasksContext();
```

- `projects: JanusProject[]` — `{ id, name, createdAt, updatedAt, workspace }`.
  Each project owns a full `workspace = { tasks, sections, boards }`.
- `createProject(name)` / `duplicateProject(id)` / `importProject(name, workspace)`
  switch to the new board and return its id.
- `removeProject` refuses to remove the last board (returns false).
- `createVersion()` snapshots the active workspace into `versions`.
- Mutations are synchronous state updates; persistence is automatic.
- `loadSample()` fills the active board with demo tasks (undo via `snapshot`/`restore`).

### Toasts

```ts
import { useToast } from "@/providers/toast-provider";
const toast = useToast();
toast.success("Task added", { description: title, duration: 2200 });
toast.show("Deleted “Work”", { action: { label: "Undo", onPress: () => restore(before) } });
```

### Clock

```ts
import { useNow } from "@/hooks/use-now";
const now = useNow(); // refreshes every 30s
```

### Domain helpers (all pure, already ported)

```ts
import { parseQuickAdd, quickAddToDraft } from "@/lib/features/quick-add";
import { filterBySmartList, groupForList, groupForListBySection, smartListLabel } from "@/lib/domain/smart-lists";
import { computeStats, sortTasks, matchesQuery, countByStatus } from "@/lib/domain/tasks-selectors";
import { deriveStatus, describeDue, STATUS_LABELS } from "@/lib/domain/status";
import { boardColor, BOARD_COLORS, normalizeBoardColor } from "@/lib/domain/boards";
import { PRIORITY_META, PRIORITY_ORDER, SORT_OPTIONS } from "@/lib/domain/constants";
import { getTaskSectionId, isCustomSection, isStatusSection, STATUS_SECTIONS } from "@/lib/domain/sections";
import { detectCardTheme, BOARD_WASHES, PRIORITY_WASHES } from "@/lib/features/card-themes";
import { computeInsightsForWindow, getPreviousPeriodPoints } from "@/lib/features/insights";
import { DEFAULT_FILTERS, computeWindowInsights, windowStartFromPreset, windowEndFromPreset, getPriorityCounts, getWeekdayCompletionCounts, computePeriodComparison, formatPeriodChange, hasActiveFilters } from "@/lib/features/insights-filters";
import { exportWorkspace, exportWorkspaceCsv, pickWorkspaceFile } from "@/lib/data/transfer";
import { parseWorkspaceJson } from "@/lib/data/workspace";
import { pluralize } from "@/lib/utils/utils";
```

- `boardColor(id)` → `{ id, label, dot, ink, tint, ring }` (concrete colors).
- `PRIORITY_META[p]` → `{ label, rank, dot, ink, tint }`.
- `describeDue(dueAt, now)` → `{ label, title, overdue, today } | null`.
- `detectCardTheme(title, description)` → `{ accent, border, wash } | null`.
- `parseQuickAdd("Buy milk tomorrow 5pm !high #work", now)` returns
  `{ title, priority, category, dueAt }`; `quickAddToDraft(parsed)` returns a `TaskDraft`.
- `exportWorkspace(workspace, name)` and `exportWorkspaceCsv(...)` open the share sheet.
- `pickWorkspaceFile()` returns `{ workspace, name } | null`.

## Screens to build

### `app/_layout.tsx`

`SafeAreaProvider` → `ThemeProvider` → `TasksProvider` → `ToastProvider` →
`GestureHandlerRootView` + `Stack` with a headerless stack, `StatusBar` style
following the theme. Global background color from the theme.

### `app/index.tsx` — Board manager

- Janus identity header (logo mark, name, one-line tagline) and theme toggle.
- Aggregate overview: board count, total tasks, completed count.
- Primary “New board” action; “Import board” action (`pickWorkspaceFile` +
  `importProject`).
- Board list/grid (2 columns on phones, more on tablets/landscape):
  colored icon tile, board name, `X tasks · Y done`, progress bar, overflow menu
  (Open, Rename, Duplicate, Export JSON, Delete). Deleting needs confirmation.
- Pressing a board calls `switchProject(id)` then `router.push("/board/" + id)`.
- Empty/loading states (`isLoading`).

### `app/board/[id].tsx` — Workspace

- Resolve `id` from `useLocalSearchParams`; if it differs from
  `currentProjectId`, call `switchProject(id)`. Redirect to `/` for unknown ids.
- Header: back button, board name, task summary, theme toggle, overflow menu.
- Segmented switcher: Board · List · Calendar · Insights.
- Search input (debounced is optional), board filter, sort (manual/due/priority/created).
- Quick add bar for Board/List/Calendar: parses via `parseQuickAdd`, adds task,
  shows toast; include a short syntax hint.
- **Board**: horizontal `ScrollView` of sections. Each column shows title, count,
  cards, and a menu (rename/delete custom sections). “Add section” tile at the end.
  Cards: complete toggle, title, due label, priority dot, board chip, subtask
  progress, keyword accent rail. Tap edits; long-press opens the move/action sheet
  (move to section via `assignTaskToSection`, complete, cancel, delete).
- **List**: grouped sections via `groupForList` (or `groupForListBySection` when
  useful), completed group exposes “Clear completed”. Rows share the task card.
- **Calendar**: month grid, prev/next/today controls, task dots per day, tap a day
  to open a day sheet listing that day’s tasks, and a way to add a task on that day
  (initial due 09:00).
- **Insights**: window switcher 7/30/90 days, summary cards (completed, streak,
  best day, period change), bar chart of daily completions, weekday distribution,
  priority split, board split. Pure RN views/SVG, no extra chart dependency.
- **Data menu** (header overflow): load sample, export JSON, export CSV, import
  board, save/restore/delete versions, clear completed. Show toasts and undo where
  the web app did.
- Small celebration when the last active task is completed is optional; keep it
  tasteful (toast is enough).

### Task editor

A modal/sheet (`Modal` + `KeyboardAvoidingView`) used for create and edit:

- Title (required), description, due date/time (`DateTimePicker`), priority chips,
  board chips, section picker, subtask add/toggle/remove.
- Save → `addTask(draft)` or `updateTask(task.id, draft)`.
- Delete + Cancel task actions for existing tasks.
- Accept an optional initial due date when creating from a calendar day.

## File ownership

Create UI under `mobile/app/` and `mobile/src/components/`. You may tune
`mobile/src/theme/tokens.ts`. Do not edit `src/lib`, `src/providers`, or
`src/hooks`; report any needed API addition instead.

## Quality bar

- Every interactive element ≥ 44×44 touch area, accessible labels on icon buttons.
- No text clipped; use `numberOfLines`, `flexShrink`, sensible min widths.
- Board columns ~280–300 px wide on phones, cards breathe.
- Warm paper light theme, warm near-black dark theme; purple primary.
- Match the web app’s information architecture and wording, minus browser chrome
  (windows, taskbar, keyboard shortcuts).
- Must pass `npx tsc --noEmit` from `mobile/`.
