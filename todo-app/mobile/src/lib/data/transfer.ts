import { File, Paths } from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import * as Sharing from "expo-sharing";
import type { Workspace } from "@/lib/domain/types";
import { parseWorkspaceJson } from "@/lib/data/workspace";
import { exportTasksToCSV } from "@/lib/features/insights-filters";

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
      dialogTitle: "Export board",
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

export interface ImportedWorkspace {
  workspace: Workspace;
  name: string;
}

/**
 * Opens the document picker and parses a Janus JSON backup. Returns null
 * when the user cancels or the file is not a usable workspace.
 */
export async function pickWorkspaceFile(): Promise<ImportedWorkspace | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;

  const asset = result.assets[0];
  const raw = await new File(asset.uri).text();
  const workspace = parseWorkspaceJson(raw);
  if (!workspace) return null;

  let name = asset.name?.replace(/\.(json|txt)$/i, "").trim() || "Imported board";
  try {
    const parsed = JSON.parse(raw) as { name?: unknown };
    if (typeof parsed.name === "string" && parsed.name.trim()) name = parsed.name.trim();
  } catch {
    // parseWorkspaceJson already succeeded, so this is only for the name.
  }

  return { workspace, name };
}
