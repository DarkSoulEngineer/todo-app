import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildWorkspace } from "@/lib/data/workspace";
import type { WorkspaceVersion } from "@/lib/domain/types";

const VERSIONS_KEY = "janus.versions.v1";

/** Reads saved workspace snapshots, tolerating missing or corrupt data. */
export async function loadVersions(): Promise<WorkspaceVersion[]> {
  try {
    const raw = await AsyncStorage.getItem(VERSIONS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value) => {
      const version = normalizeVersion(value);
      return version ? [version] : [];
    });
  } catch {
    return [];
  }
}

/** Persists workspace snapshots. Returns false when the write failed. */
export async function saveVersions(versions: WorkspaceVersion[]): Promise<boolean> {
  try {
    await AsyncStorage.setItem(VERSIONS_KEY, JSON.stringify(versions));
    return true;
  } catch {
    return false;
  }
}

function normalizeVersion(value: unknown): WorkspaceVersion | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.label !== "string" ||
    !record.label.trim() ||
    typeof record.createdAt !== "string"
  ) {
    return null;
  }

  const workspace = buildWorkspace(record.workspace);
  if (!workspace) return null;

  return {
    id: record.id,
    projectId: typeof record.projectId === "string" ? record.projectId : "",
    label: record.label.trim(),
    createdAt: record.createdAt,
    taskCount: workspace.tasks.length,
    workspace,
  };
}
