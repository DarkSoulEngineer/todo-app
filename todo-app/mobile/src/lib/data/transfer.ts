import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { parseSettingsJson, serializeSettings, type AppSettings } from "@/lib/data/settings";
import type { Workspace } from "@/lib/domain/types";
import { parseWorkspaceJson } from "@/lib/data/workspace";
import { parseBackupJson, parseBoardsJson, serializeFullBackup, type ImportedBackup } from "@/lib/data/backup";
import { exportProjectsToCSV, exportTasksToCSV } from "@/lib/features/insights-filters";
import type { ProjectImport } from "@/lib/domain/projects";

export { parseBoardsJson } from "@/lib/data/backup";

function safeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "janus-board";
}

/** Writes a file into the cache directory and opens the share sheet. */
async function shareText(fileName: string, mimeType: string, contents: string): Promise<void> {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) throw new Error("File sharing is unavailable on this device.");
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(contents);

  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle: "Export Janus backup",
    UTI: mimeType === "text/csv" ? "public.comma-separated-values-text" : "public.json",
  });
}

export async function exportSettings(settings: AppSettings): Promise<void> {
  await shareText(
    `janus-settings-${new Date().toISOString().slice(0, 10)}.json`,
    "application/json",
    serializeSettings(settings),
  );
}

export async function exportFullBackup(boards: ProjectImport[], settings: AppSettings): Promise<void> {
  await shareText(
    `janus-backup-${new Date().toISOString().slice(0, 10)}.json`,
    "application/json",
    serializeFullBackup(boards, settings),
  );
}

export async function pickBackupFile(): Promise<ImportedBackup | null> {
  const picked = await pickJsonFile();
  if (!picked) return null;
  const backup = parseBackupJson(picked.raw);
  if (!backup) throw new Error("Choose a valid Janus JSON backup.");
  if (backup.boards.length === 1 && backup.boards[0].name === "Imported board") {
    backup.boards[0].name = picked.name;
  }
  return backup;
}

/** Cancellation is not an error; invalid backups are rejected before any changes. */
export async function pickSettingsFile(): Promise<AppSettings | null> {
  const picked = await pickJsonFile();
  if (!picked) return null;
  const settings = parseSettingsJson(picked.raw);
  if (!settings) throw new Error("Could not import settings. Choose a valid Janus settings JSON backup (version 1).");
  return settings;
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

async function pickJsonFile(): Promise<{ raw: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const raw = Platform.OS === "web" && asset.file
    ? await asset.file.text()
    : await new File(asset.uri).text();
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
