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
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { workspace: empty, hadData: false };

    const workspace = buildWorkspace(JSON.parse(raw));
    if (!workspace) return { workspace: empty, hadData: false };
    return { workspace, hadData: true };
  } catch {
    return { workspace: empty, hadData: false };
  }
}
