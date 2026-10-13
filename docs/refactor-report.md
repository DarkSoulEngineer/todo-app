# Stride To‑Do — Refactor, Bug Fixes & Optimizations

A single pass over the app to (1) reorganize the source into a clean, feature‑based
structure, (2) find and fix bugs, and (3) remove duplication and dead code.
All work is local on `main`; nothing was pushed. No automated test suite exists in the
repo, so every change was gated on `npx tsc --noEmit`, `npm run lint`, and
`npm run build` (Turbopack) — all green at HEAD.

## Commits

| Commit | Scope |
| --- | --- |
| `d7cab14` | chore: WIP checkpoint before the refactor (reversibility) |
| `b121512` | refactor: reorganize `src` into feature‑based folders, remove dead files |
| `d8d677b` | fix: task rename, selection nav, status side‑effects, keyword matching |
| `5697c5d` | refactor: dedupe lib helpers, split presentation from domain, drop dead code |
| `4904d6d` | fix(board): settle‑throttle drag preview to stop render loop |

## 1. Target structure

`src` is now grouped by **feature / concern**, not by file type. `app/` keeps the
Next.js route conventions and `hooks/` stays flat (they are already cohesive).

```
src/
  app/                     # Next.js routes only (layout, page, tasks/page, manifest, globals.css)
  components/
    ui/                    # primitives: button, chip, dialog, field, progress, tooltip
    providers/             # app-toaster, service-worker-register, tasks-provider, theme-provider
    layout/                # app-shell, sidebar, todo-app, top-bar
    common/                # cross-feature widgets (celebration, data-menu, empty-state,
                           #   shortcuts-help, theme-toggle, view-switcher, status-meta)
    board/                 # board-canvas, board-card, board-manager(-card), board-section,
                           #   board-view, board-zoom-controls
    tasks/                 # task-card/list/badges/dialog/tooltip, complete-toggle, quick-add,
                           #   selection-toolbar, sortable-task-card, subtask-list, task-skeleton
    calendar/              # calendar-grid, calendar-task-chip, calendar-view, day-dialog
    insights/              # insights-filters/panel/quick-actions/view, productivity-charts,
                           #   stats-dashboard
    list/                  # list-view
  hooks/                   # use-keyboard-shortcuts, use-mounted, use-now, use-task-selection, use-tasks
  lib/
    domain/                # pure business logic & types (no React, no icons):
                           #   types, constants, status, status-keywords, task-factory, sections,
                           #   boards, categories, projects, smart-lists, tasks-selectors
    data/                  # persistence & fixtures: storage, sample
    features/              # feature-scoped helpers: card-themes, insights, insights-filters, quick-add
    utils/                 # generic helpers: utils, datetime, id, board-viewport
```

**Boundary rules now enforced:**

- `lib/domain/**` is **pure** — no `react`, no `lucide-react`, no component imports.
- UI/presentation metadata lives with the UI. `STATUS_META` (labels + icons + class
  recipes) moved to `components/common/status-meta.ts`. Only the presentation‑neutral
  `STATUS_LABELS` string map stayed in `lib/domain/status.ts` (needed by domain logic
  for section titles), so the UI and the domain share one source of truth without a
  domain → UI dependency.
- `lib/utils/id.ts` is the single id generator (`makeId`); ad‑hoc `nanoid()` calls were
  removed. `lib/domain/tasks-selectors.ts` checks all imports as `@/...` (no relative
  paths anywhere).

## 2. Bugs found & fixed

**Critical / high**

- **C1 — inline rename was discarded.** Editing a task title in the card saved nothing
  because the commit path dropped the new value. Rename now routes through
  `patchTask(id, { title })` and the read‑only guards were corrected (`task-card.tsx`,
  `list-view.tsx`, `task-list.tsx`).
- **H1 — bulk priority change corrupted status.** Applying a priority to a selection
  also wrote a status field, flipping completed/canceled items. The toolbar now uses a
  proper `TaskPatch` and touches only the priority (`selection-toolbar.tsx`).
- **H2 — `applyDraft` forced status one‑way.** Dialog edits could reset a completed or
  canceled task back to open. `applyDraft` no longer touches `completed`/`canceled`;
  status is derived (`task-factory.ts`).
- **H3 — keyword → status matching was substring‑based.** "box" matched "boxing",
  "cancel" matched "canceled" inside unrelated words. Matching is now word‑boundary
  based and ambiguous words were removed (`status-keywords.ts`).
- **Board render loop (reported live).** Dragging a card across columns threw
  `Maximum update depth exceeded` (React attributed it to `SortableContext items` in
  `board-section.tsx`). Mechanism: every `onDragOver` committed the live preview
  (`boardItems`), and because the active card is rendered **inside the target column** that
  commit reflowed the DOM; dnd‑kit's `ResizeObserver` saw the reflow, re‑measured, recomputed
  collisions/`overId` and fired `onDragOver` again — all within the same task — until React's
  nested‑update limit tripped. Fix (`4904d6d`): publish the preview on a **settle throttle**
  (120 ms idle / 450 ms max) so commits are spaced across tasks and can no longer re‑enter
  synchronously; a pure `computeDragOrder` additionally returns the **same reference** for a
  no‑op move, and the working order lives in a ref so the drop position stays exact.
  *(Note: `@dnd-kit/sortable` already value‑compares `items`, so reference churn alone was
  not the literal trigger — the async spacing is the effective guard.)*

**Medium / low**

- **M1 — dead keyboard navigation** in selection mode (no‑op handlers) removed/repaired.
- **M2 — shared menu anchor ref** caused two menus to share one anchor; each menu now owns
  its own positioning.
- **M3/M4 — status + a11y polish** (correct `aria`/label wiring on status controls).
- **L3 — calendar epoch cursor** could start one day off near midnight; corrected.
- **L4 — no‑op prop** passed into a child removed.

## 3. Optimizations applied

- **Dead code removed** — 3 unused components (`app-header`, `task-toolbar`, `status-tabs`)
  and 11 unreferenced exports (e.g. `selectVisibleTasks`/`TaskQuery`, `getStorageState`/
  `saveWorkspace`, `computeInsights`, `dateTimeLocalNow`, several `boards` helpers,
  `UPCOMING_WASH`), plus their orphaned private helpers/imports. Net **−263 lines** in the
  dedup commit alone.
- **Single source of truth for priority colors** — hardcoded `bg-amber-500`‑style class
  strings in the selection toolbar and the insights charts now derive from
  `PRIORITY_META`, so a color change is one edit.
- **Insights filtering de‑duplicated** — the triplicated board/status/priority predicate
  is now `filterTasksByFilters(tasks, filters, now)` in `lib/features/insights-filters.ts`,
  reused by the charts, quick actions, and stats dashboard.
- **Single id generator** — `makeId(size?)` in `lib/utils/id.ts`, used across
  `lib/**` and `use-tasks.ts`.
- **Domain/presentation split** — `lib/domain/status.ts` no longer pulls `lucide-react`
  or React into the pure domain.

## 4. Known issues left in place (documented, intentionally NOT changed)

These need a product decision or would change behavior that has no test coverage:

- **L1 — `reorderTasks` slot math** is more convoluted than necessary and is the most
  likely remaining source of subtle order bugs. Low priority; rewrite behind a test.
- **L2 — board pin‑drop boundary** in `board-manager.tsx`: dropping a card at the exact
  boundary between two pins is ambiguous. Intended UX is unclear, so it was left as‑is.
- **Insights window math divergence** — `insights-panel.tsx` and `stats-dashboard.tsx`
  compute their own date windows (end‑of‑day at `23:59:59.999`, fallback to `now` for null
  custom bounds), which differs from the lib helpers (`startOfDay`). For `"7d"` this yields
  8 bars vs the helper's 7. Behavior was preserved to avoid silently changing counts; align
  only with a product sign‑off.

## 5. Recommended follow‑ups (not executed — risky without tests)

1. **Shared Menu / Popover primitive.** The board section menu, board card menu, task card
   menu and the data menu each re‑implement portal + anchor math + outside‑click + Escape.
   Consolidate into one `ui/menu` primitive, then delete three copies.
2. **Collapse `SortableTaskCard`.** It largely wraps `TaskCard` with drag wiring; most of
   its props mirror the card. Fold the sortable behaviour into a slim wrapper so there is
   one card implementation.
3. **Simplify the board preview‑loop fix (`4904d6d`).** The accepted fix uses a two‑tier
   settle/max‑wait throttle. A single **rAF‑coalesced flush** of the working ref (commit at
   most once per frame, always the latest order) is simpler, frame‑accurate, and removes
   `previewSinceRef` plus the 450 ms branch. Longer term, address the structural cause:
   exclude the dragged card from the rendered list (the standard dnd‑kit pattern) so the
   preview reflow stops driving `ResizeObserver` measurement at all.
4. **Split the monoliths.** These files mix data, effects, layout and handlers and are the
   hardest to reason about; extracting hooks + subcomponents would help most:
   `board-manager.tsx`, `task-card.tsx`, `sidebar.tsx`, `board-manager-card.tsx`,
   `board-view.tsx`, `todo-app.tsx`, `productivity-charts.tsx`.
5. **Add a test harness.** Every fix here was verified only by types + lint + build. A few
   component/unit tests (drag order, insights windows, status derivation, persistence
   round‑trip) would make future refactors safe. `computeDragOrder` is pure and trivial to
   cover first.
6. **Minor hygiene** — container lookup in `board-view.tsx` uses the `in` operator
   (`:58`, `:90`), which walks `Object.prototype`; prefer `Object.hasOwn`. Harmless with
   nanoid ids, but a smell.

## 6. Verification

- `npx tsc --noEmit` — clean
- `npm run lint` (eslint) — clean
- `npm run build` (Next 16.4, Turbopack) — compiled, 6/6 static pages (`/`, `/_not-found`,
  `/manifest.webmanifest`, `/tasks`)
- Board drag loop (`4904d6d`): fixed and exercised against a live dev server (mount + drag
  stress + viewport resizes → no exceptions); independently reviewed for correctness,
  regressions and drop‑position accuracy.
- Independent review of `b121512` / `d8d677b` / `5697c5d` / `4904d6d`: confirmed
  behavior‑preserving (dead exports genuinely unreferenced, domain/presentation seam intact,
  zero relative imports, no circular deps, no regressions in drag/drop). Its two substantive
  notes — the imprecise root‑cause wording and a simpler rAF design — are folded into §2
  and §5.
- No test suite exists in the repo (noted in §5.5).
