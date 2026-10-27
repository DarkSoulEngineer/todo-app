import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import type { Workspace } from "@/lib/domain/types";
import { buildWorkspace, parseWorkspaceJson } from "@/lib/data/workspace";
import { exportProjectsToCSV, exportTasksToCSV } from "@/lib/features/insights-filters";
import type { ProjectImport } from "@/lib/domain/projects";

function safeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "janus-board";
}

/** Writes a file into the cache directory and opens the share sheet. */
async function shareText(fileName: string, mimeType: string, contents: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(contents);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: "Export Janus backup",
      UTI: mimeType === "text/csv" ? "public.comma-separated-values-text" : "public.json",
    });
  }
}

/** Shares a board as a JSON backup that can be imported on any device. */
export async function exportWorkspace(workspace: Workspace, boardName: string): Promise<void> {
  const payload = {
    app: "janus",
    version: 1,
    name: boardName,
    exportedAt: new Date().toISOString(),
    ...workspace,
  };
  await shareText(
    `${safeName(boardName)}-janus.json`,
    "application/json",
    JSON.stringify(payload, null, 2),
  );
}

/** Shares the tasks of a workspace as CSV (same columns as the web build). */
export async function exportWorkspaceCsv(workspace: Workspace, boardName: string): Promise<void> {
  await shareText(
    `${safeName(boardName)}-tasks.csv`,
    "text/csv",
    exportTasksToCSV(workspace.tasks, workspace.boards),
  );
}

/** Shares every board in one JSON file that can be imported on any device. */
export async function exportAllBoards(boards: ProjectImport[]): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  const payload = {
    app: "janus",
    version: 2,
    kind: "janus-boards",
    exportedAt: new Date().toISOString(),
    boardCount: boards.length,
    projects: boards.map((board) => ({
      name: board.name,
      closedAt: board.closedAt,
      workspace: board.workspace,
    })),
  };
  await shareText(
    `janus-all-boards-${stamp}.json`,
    "application/json",
    JSON.stringify(payload, null, 2),
  );
}

/** Shares every task across all boards as one CSV, with a board column. */
export async function exportAllBoardsCsv(boards: ProjectImport[]): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10);
  await shareText(
    `janus-all-boards-${stamp}.csv`,
    "text/csv",
    exportProjectsToCSV(boards),
  );
}

export interface ImportedWorkspace {
  workspace: Workspace;
  name: string;
}

function optionalName(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function optionalClosedAt(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const closedAt = (value as Record<string, unknown>).closedAt;
  if (typeof closedAt !== "string") return undefined;
  const date = new Date(closedAt);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * Reads a JSON backup containing one board or a full all-board export.
 * Single-board exports and older Janus backups are returned as one entry.
 */
export function parseBoardsJson(raw: string): ProjectImport[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const projects = (parsed as Record<string, unknown>).projects;
      if (Array.isArray(projects)) {
        const boards: ProjectImport[] = [];
        for (const [index, entry] of projects.entries()) {
          if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return null;
          const record = entry as Record<string, unknown>;
          const workspace = buildWorkspace(record.workspace ?? record);
          if (!workspace) return null;
          boards.push({
            name: optionalName(record) ?? `Imported board ${index + 1}`,
            closedAt: optionalClosedAt(record),
            workspace,
          });
        }
        return boards.length > 0 ? boards : null;
      }
    }

    const workspace = buildWorkspace(parsed);
    if (!workspace) return null;
    return [{ name: optionalName(parsed) ?? "Imported board", workspace }];
  } catch {
    return null;
  }
}

async function pickJsonFile(): Promise<{ raw: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const raw = await new File(asset.uri).text();
  const name = asset.name?.replace(/\.(json|txt)$/i, "").trim() || "Imported board";
  return { raw, name };
}

/**
 * Opens the document picker and parses a Janus backup. Returns null when the
 * user cancels or the file is not a usable board backup.
 */
export async function pickBoardsFile(): Promise<ProjectImport[] | null> {
  const picked = await pickJsonFile();
  if (!picked) return null;
  const boards = parseBoardsJson(picked.raw);
  if (!boards) return null;

  if (boards.length === 1 && boards[0].name === "Imported board") {
    return [{ ...boards[0], name: picked.name }];
  }
  return boards;
}

/**
 * Opens the document picker and parses a Janus JSON backup. Returns null
 * when the user cancels or the file is not a usable workspace.
 */
export async function pickWorkspaceFile(): Promise<ImportedWorkspace | null> {
  const picked = await pickJsonFile();
  if (!picked) return null;

  const workspace = parseWorkspaceJson(picked.raw);
  if (!workspace) return null;

  let name = picked.name;
  try {
    const parsed = JSON.parse(picked.raw) as { name?: unknown };
    if (typeof parsed.name === "string" && parsed.name.trim()) name = parsed.name.trim();
  } catch {
    // parseWorkspaceJson already succeeded, so this is only for the name.
  }

  return { workspace, name };
}
