import { defaultBoards } from "@/lib/domain/boards";
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from "@/lib/domain/constants";
import { defaultSections } from "@/lib/domain/sections";
import type { Workspace } from "@/lib/domain/types";
import { buildWorkspace } from "@/lib/data/workspace";

export { buildWorkspace, parseWorkspaceJson } from "@/lib/data/workspace";

/** Reads the workspace from localStorage. Always safe to call, even on the server. */
export function loadWorkspace(): { workspace: Workspace; hadData: boolean } {
  const empty: Workspace = { tasks: [], sections: defaultSections(), boards: defaultBoards() };
  if (typeof window === "undefined") return { workspace: empty, hadData: false };

  try {
    // A corrupt current payload must not mask a usable legacy backup.
    for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const workspace = buildWorkspace(JSON.parse(raw));
        if (workspace) return { workspace, hadData: true };
      } catch {
        // Try the next migration key before falling back to an empty workspace.
      }
    }
  } catch {
    // Storage can be blocked entirely (for example in private browsing).
  }
  return { workspace: empty, hadData: false };
}
