export interface Command {
  id: string;
  label: string;
  detail?: string;
  shortcut?: string;
  selected?: boolean;
  children?: Command[];
  run?: () => void;
}

export function filterCommands(commands: Command[], query: string): Command[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return commands.filter((command) => words.every((word) => `${command.label} ${command.detail ?? ""}`.toLowerCase().includes(word)));
}

interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}

/** Deliberately exact modifiers: don't steal browser/OS shortcuts or IME input. */
export function commandShortcut(event: KeyInput, editing: boolean, singleKeyShortcuts = true): string | null {
  if (event.defaultPrevented || event.repeat || event.isComposing || editing) return null;
  const key = event.key.toLowerCase();
  // Single numeric keys (1-9) require a modifier to avoid conflicting with typing.
  if (singleKeyShortcuts && ["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(key)) {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      return ({ "1": "view-board", "2": "view-list", "3": "view-calendar", "4": "view-insights" } as Record<string, string>)[key] ?? null;
    }
    return null;
  }
  // Leave every Ctrl/Command/Alt combination to the browser and operating system.
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  if (key === "?" || (key === "/" && event.shiftKey)) return "help";
  if (key === "/") return "palette";
  if (!singleKeyShortcuts) return null;
  if (event.shiftKey) {
    if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) return `card-${key.slice(5)}`;
    return ({ r: "rename-board", b: "switch-board", h: "all-boards", t: "top-tasks", s: "settings", f: "clear-filters", l: "add-tag", x: "remove-tag", v: "hidden-tools", o: "actions-tools", u: "home-tools", p: "pin-ribbon", c: "restore-selected", d: "dragging", m: "load-sample", a: "change-theme", e: "change-theme", g: "change-theme", i: "change-theme", j: "change-theme", k: "change-theme", q: "change-theme", w: "change-theme", y: "change-theme", z: "change-theme" } as Record<string, string>)[key] ?? null;
  }
  return ({ n: "new-card", b: "new-board", l: "new-list", r: "rename-card", "1": "view-board", "2": "view-list", "3": "view-calendar", "4": "view-insights", "[": "previous-board", "]": "next-board", q: "search-tasks", f: "filter-tags", o: "sort-tasks", v: "select-mode", a: "select-all", u: "unselect-all", m: "move-selected", p: "priority-selected", d: "complete-selected", c: "cancel-selected", k: "compact", g: "focus-column", w: "move-arrows", "=": "zoom-in", "-": "zoom-out", "0": "zoom-reset", e: "change-theme", h: "change-theme", i: "change-theme", j: "change-theme", s: "change-theme", t: "change-theme", x: "change-theme", y: "change-theme", z: "change-theme" } as Record<string, string>)[key] ?? null;
}

export const PALETTE_HELP = [
  ["/", "Open command palette"],
  ["? (Shift /)", "Keyboard shortcut help"],
  ["↑ / ↓", "Select a palette result"],
  ["Enter", "Run command / choose target"],
  ["Esc", "Back one step / close palette"],
];