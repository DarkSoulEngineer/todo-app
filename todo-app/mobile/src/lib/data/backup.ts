import type { ProjectImport } from "@/lib/domain/projects";
import { buildWorkspace } from "@/lib/data/workspace";
import { parseSettingsJson, serializeSettings, type AppSettings } from "@/lib/data/settings";

export interface ImportedBackup {
  boards: ProjectImport[];
  settings: AppSettings | null;
}

export function serializeFullBackup(boards: ProjectImport[], settings: AppSettings): string {
  return JSON.stringify({
    ...JSON.parse(serializeSettings(settings)),
    kind: "janus-backup",
    projects: boards.map(({ name, closedAt, workspace }) => ({ name, closedAt, workspace })),
  }, null, 2);
}

/** Validate both parts of a full backup before allowing either to be restored. */
export function parseBackupJson(raw: string): ImportedBackup | null {
  try {
    const parsed: unknown = JSON.parse(raw.replace(/^\uFEFF/, ""));
    if (isRecord(parsed) && parsed.kind === "janus-backup") {
      const settings = parseSettingsJson(JSON.stringify({ ...parsed, kind: "janus-settings" }));
      if (!settings || !Array.isArray(parsed.projects)) return null;
      const boards = parsed.projects.length === 0 ? [] : parseBoardsJson(raw);
      return boards ? { boards, settings } : null;
    }
    if (isRecord(parsed) && parsed.kind === "janus-settings") {
      const settings = parseSettingsJson(raw);
      return settings ? { boards: [], settings } : null;
    }
    const boards = parseBoardsJson(raw);
    return boards ? { boards, settings: null } : null;
  } catch {
    return null;
  }
}

/** Reads current all-board exports and legacy single-board backups. */
export function parseBoardsJson(raw: string): ProjectImport[] | null {
  try {
    const parsed: unknown = JSON.parse(raw.replace(/^\uFEFF/, ""));
    if (isRecord(parsed) && Array.isArray(parsed.projects)) {
      const boards: ProjectImport[] = [];
      for (const [index, entry] of parsed.projects.entries()) {
        if (!isRecord(entry)) return null;
        const workspace = buildWorkspace(entry.workspace ?? entry);
        if (!workspace) return null;
        const closedAt = typeof entry.closedAt === "string" ? new Date(entry.closedAt) : null;
        boards.push({
          name: optionalName(entry) ?? `Imported board ${index + 1}`,
          closedAt: closedAt && !Number.isNaN(closedAt.getTime()) ? closedAt.toISOString() : undefined,
          workspace,
        });
      }
      return boards.length ? boards : null;
    }
    const workspace = buildWorkspace(parsed);
    return workspace ? [{ name: optionalName(parsed) ?? "Imported board", workspace }] : null;
  } catch {
    return null;
  }
}

function optionalName(value: unknown): string | null {
  if (!isRecord(value)) return null;
  return typeof value.name === "string" && value.name.trim() ? value.name.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
