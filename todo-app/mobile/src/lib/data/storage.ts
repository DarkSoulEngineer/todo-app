import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultBoards } from "@/lib/domain/boards";
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from "@/lib/domain/constants";
import { defaultSections } from "@/lib/domain/sections";
import type { Workspace } from "@/lib/domain/types";
import { buildWorkspace } from "@/lib/data/workspace";

export { buildWorkspace, parseWorkspaceJson } from "@/lib/data/workspace";

export function emptyWorkspace(): Workspace {
  return { tasks: [], sections: defaultSections(), boards: defaultBoards() };
}

/** Reads the workspace from device storage. Always safe to call. */
export async function loadWorkspace(): Promise<{ workspace: Workspace; hadData: boolean }> {
  try {
    // A corrupt current payload must not mask a usable legacy backup.
    for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const workspace = buildWorkspace(JSON.parse(raw));
        if (workspace) return { workspace, hadData: true };
      } catch {
        // Try the next migration key before falling back to an empty workspace.
      }
    }
  } catch {
    // Storage can be unavailable; return the safe empty workspace below.
  }
  return { workspace: emptyWorkspace(), hadData: false };
}
