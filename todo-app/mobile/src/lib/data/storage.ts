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
    const raw = await AsyncStorage.getItem(STORAGE_KEY) ?? await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { workspace: emptyWorkspace(), hadData: false };

    const workspace = buildWorkspace(JSON.parse(raw));
    if (!workspace) return { workspace: emptyWorkspace(), hadData: false };
    return { workspace, hadData: true };
  } catch {
    return { workspace: emptyWorkspace(), hadData: false };
  }
}
