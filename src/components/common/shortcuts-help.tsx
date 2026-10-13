"use client";

import { Dialog } from "@/components/ui/dialog";

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["n"], label: "New task" },
  { keys: ["/"], label: "Focus the search field" },
  { keys: ["?"], label: "Show keyboard shortcuts" },
  { keys: ["Esc"], label: "Close the open dialog or menu" },
  { keys: ["Tab"], label: "Move focus between controls" },
  { keys: ["Space"], label: "Toggle the focused task or checkbox" },
];

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Small moves that keep you in flow."
    >
      <ul className="space-y-1">
        {SHORTCUTS.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-4 rounded-xl px-2 py-2 even:bg-muted/40"
          >
            <span className="text-sm text-foreground">{item.label}</span>
            <span className="flex items-center gap-1">
              {item.keys.map((key) => (
                <kbd
                  key={key}
                  className="rounded-md border border-border bg-muted px-2 py-1 font-mono text-[11px] font-semibold text-muted-foreground"
                >
                  {key}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">
        Drag the handle on the left of a task to reorder it. Reordering works in manual sort.
      </p>
    </Dialog>
  );
}
