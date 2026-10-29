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
  top-tasks.tsx          prioritized cross-board Top 3 / Top 10 overview
  my-tasks.tsx           legacy redirect to Top Tasks
  calendar.tsx           legacy redirect to Top Tasks
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
    use-all-board-tasks.ts  live open-board aggregation for Top Tasks
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

### Backups

In **Settings → Data & backups → Save**, select **Preferences**, **Boards**, or
**All**, then tap **Save file**. Preferences includes theme, default calendar view,
and week start. Boards includes every board, list, and task as JSON.
All creates one `janus-backup` JSON file containing both boards and preferences,
even when there are no boards. Changes also save locally automatically.

**Import** accepts preferences-only, boards-only, legacy single-board, and combined
JSON backups. It adds imported boards and replaces only preferences included in the
file. Both parts of a combined backup are validated before either is applied.
CSV files cannot be imported as backups.

On Android/iOS, select a destination in the share sheet to keep the exported file.
On web, export starts a download. Run the backup codec checks with Node 24:
`node --test tests/*.test.mjs`.

## Navigation

The mobile app uses a shared ribbon top bar and a three-tab bottom navigation:

| Tab | Route | Purpose |
|---|---|---|
| Home | `app/index.tsx` | Board manager with open/closed boards, import, create, and rearrange. |
| Top Tasks | `app/top-tasks.tsx` | Top 3 or Top 10 unfinished tasks across open boards, with editing, completion, and board navigation. |
| Settings | `app/settings.tsx` | App-level appearance, calendar defaults, data/backups, and About. |

Board-specific work stays in `app/board/[id].tsx` and keeps its own
Board / List / Calendar / Insights ribbon. Calendar is available **only inside
boards**, including its day-task sheet and task creation. Calendar defaults in
Settings apply to these board calendars. The old `/calendar`
and `/my-tasks` routes redirect to `/top-tasks`.

Top Tasks ranks high priority before medium before low, then earlier deadlines
(including overdue work) before undated tasks. Oldest creation date and stable
board/task IDs break ties. Completed, canceled, and closed-board tasks are excluded.
Completing a task automatically reveals the next ranked task.

All three top-level screens share the ribbon top-bar/search styling, content
width, page padding, and bottom-nav clearance from `src/theme/layout.ts`.
Interacting with a ribbon control resets its auto-hide timer.

## Command palette

Use the file-list icon beside Search on Home or the board ribbon. Search actions,
then choose a target for rename and move commands. On web, the help button lists
the shortcuts available in the current view.

On web (including tablet browsers with a hardware keyboard):

- **/** opens commands; **?** (**Shift + /**) opens shortcut help.
- **B** creates a board. Inside a board, **N** creates a card, **L** creates a list,
  **R** chooses a card to rename, and **Shift R** renames the board.
- **Shift + arrow keys** chooses a card to move: left/right between visible lists,
  up/down within its list. Moves have Undo and stop at boundaries.
- **Shift B** opens searchable board selection on Home,
  boards, Top Tasks, and Settings. **[ / ]** cycles through open boards.
- **Shift H/T/S** opens Home / board selection, Top Tasks, or Settings.
- Inside a board, **1/2/3/4** switches to Board / Activity / Calendar / Insights.
  The palette also offers compact cards, focused columns, move arrows, dragging,
  and zoom controls.
- **Q** focuses task search, **F** picks a tag filter, **Shift F** clears search
  and filters, **O** picks card sorting, **Shift L** creates a tag, and **Shift X**
  removes a tag (after confirmation).
- **K/G/W** toggles compact cards / focused column / move arrows; **=/-/0** zooms
  in / out / resets. **Shift D** toggles dragging on tablet/desktop Board view.
- **Shift U/O/V** reveals Home / Actions / Hidden ribbon tools; **Shift P** pins
  or unpins the ribbon. Hidden tools are available only when lists are hidden.
- **Shift M** loads sample data into the current board, with Undo available.
- **V** enters/exits card selection. While selecting, use the palette to select
  individual cards; **A/U** selects/unselects all visible cards, **D/C/Shift C**
  completes/cancels/restores selected cards, **M** moves them, and **P** sets priority.
- Other ribbon actions—including list visibility, sample data, import/export,
  saved versions, clearing completed cards, and closing a board—are searchable
  commands. Destructive palette actions have a confirmation step. Commands and
  help only show actions available in the current view and selection state.
- In the palette, **↑/↓** selects, **Enter** runs, and **Esc** goes
  back or closes. Typing filters commands and targets.

Global shortcuts pause in text fields and dialogs. Native Android/iOS supports
the same commands by touch; global hardware-keyboard shortcuts are web-only.
Ctrl, Command, and Alt combinations are never intercepted, including while the
palette is open, so browser shortcuts keep working.
Keybind configuration is hidden on mobile because phones have no hardware
keyboard. The **Commands** entry in Settings opens the same tap-friendly command
palette, and all actions remain available by touch.

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
