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
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    if (key === "k" && !event.shiftKey) return "palette";
    if (key === "p" && event.shiftKey) return "palette";
    if (key === "b" && event.shiftKey) return "switch-board";
    if (key === "," && !event.shiftKey) return "settings";
    return null;
  }
  if (event.ctrlKey || event.metaKey) return null;
  if (event.altKey) {
    if (event.shiftKey) return null;
    if (["1", "2", "3"].includes(key)) return ({ "1": "all-boards", "2": "top-tasks", "3": "settings" } as Record<string, string>)[key];
    return ["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key) ? `card-${key.slice(5)}` : null;
  }
  if (key === "?" && !event.altKey) return "help";
  if (!singleKeyShortcuts) return null;
  if (event.shiftKey) return ({ r: "rename-board", b: "switch-board" } as Record<string, string>)[key] ?? null;
  return ({ n: "new-card", b: "new-board", l: "new-list", r: "rename-card", "1": "view-board", "2": "view-list", "3": "view-calendar", "4": "view-insights", "[": "previous-board", "]": "next-board" } as Record<string, string>)[key] ?? null;
}

export const PALETTE_HELP = [
  ["Ctrl/⌘ K · Ctrl/⌘ Shift P", "Open command palette"],
  ["?", "Keyboard shortcut help"],
  ["↑ / ↓ · Ctrl J / K", "Select a palette result"],
  ["Enter", "Run command / choose target"],
  ["Esc", "Back one step / close palette"],
];
