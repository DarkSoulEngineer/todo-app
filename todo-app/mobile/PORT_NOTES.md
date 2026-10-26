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

## Current behavior

These notes supersede older build briefs that describe the app as unfinished.

- Top-level navigation is the four-tab ribbon: Home, My Tasks, Calendar, and
  Settings. The board route keeps its own Board / List / Calendar / Insights
  ribbon.
- Home owns board management (create, import, rearrange, open/close boards).
  My Tasks and Calendar aggregate tasks from every open board; tapping a task
  opens the board that owns it.
- My Tasks is an overview, not a creation surface. Its filter is a single-select
  menu with `None` as the default.
- Settings is app-level: appearance, calendar defaults, data/backups, and About.
  It does not show current-board data.
- Board columns are called **lists** in the UI. The domain model keeps
  `BoardSection`/`sectionId`, so internal names stay unchanged.
- Canceling a card creates or reuses a custom **Canceled** list, unhides it if
  needed, and moves the card into it. Restoring a card moves it out again.
  This also applies to bulk cancellation and status changes.
- Deleting a list keeps its cards; they move to Unsorted or a matching status
  list. Use the in-app confirmation sheet rather than `Alert.alert`, which is a
  no-op under react-native-web.
- Tags are board categories. The Filters tab can create one through
  **Add filter/tag**; the card editor has no separate tag field.
- The app is local and single-user. Assignees, avatars, user names, emails, and
  multiuser identity are intentionally absent.
- The four top-level screens share the ribbon top bar/search styling and the
  content width/padding tokens in `src/theme/layout.ts`. Interacting with any
  ribbon control resets its auto-hide timer.

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

## Screen contracts

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
- Create cards from the ribbon **New card** action or the add-card control at
  the end of each list.
- **Board**: horizontal `ScrollView` of lists. Each column shows title, count,
  cards, and a menu (rename/hide/reorder/delete custom lists). “Add list” tile at
  the end. Deleting a list requires an in-app confirmation and keeps its cards.
  Cards: complete toggle, title, due label, priority dot, board chip, subtask
  progress, keyword accent rail. Tap edits; long-press opens the move/action sheet
  (move to list via `assignTaskToSection`, complete, cancel, delete). Canceling
  moves the card into the auto-created **Canceled** list.
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

- Existing tasks open as **Task details**; new tasks open as **New task**. There is
  no eyebrow label above the title.
- Title (required), description, due date/time (`DateTimePicker`), priority chips,
  board chips, list picker, subtask add/toggle/remove.
- Creating uses the **Add task** button → `addTask(draft)`.
- Editing auto-saves through `updateTask(task.id, draft)` after a short debounce,
  flushes any pending change when the sheet closes, and has no **Save changes**
  button.
- Delete + Cancel task actions for existing tasks. Canceling also moves the card
  into the **Canceled** list; restoring moves it out.
- Accept an optional initial due date when creating from a calendar day.

## File ownership

Screen and component work lives under `mobile/app/` and
`mobile/src/components/`. Domain rules, persistence, and shared state live under
`mobile/src/lib/`, `mobile/src/providers/`, and `mobile/src/hooks/`. Keep those
layers pure and reusable instead of duplicating storage or task logic in screens,
then run the mobile checks below.

## Quality bar

- Every interactive element ≥ 44×44 touch area, accessible labels on icon buttons.
- No text clipped; use `numberOfLines`, `flexShrink`, sensible min widths.
- Board columns ~280–300 px wide on phones, cards breathe.
- Warm paper light theme, warm near-black dark theme; purple primary.
- Match the web app’s information architecture and wording, minus browser chrome
  (windows, taskbar, keyboard shortcuts).
- Must pass `npx tsc --noEmit` from `mobile/`.
