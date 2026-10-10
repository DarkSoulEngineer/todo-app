#!/usr/bin/env node
/**
 * Generates docs/documentatie.docx directly from docs/documentatie.md
 * so the Word file can never drift out of sync with the Markdown source.
 *
 * Usage: node docs/generate-docx.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

const here = dirname(fileURLToPath(import.meta.url));
const mdPath = join(here, "documentatie.md");
const outPath = join(here, "documentatie.docx");

const md = readFileSync(mdPath, "utf8");

const lines = md.split(/\r?\n/);

/** Inline code spans and bold, in that nesting-agnostic order. */
function inlineRuns(text) {
  const runs = [];
  // Split on `code` and **bold** markers, keeping the delimiters.
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: "Consolas" }));
    } else if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true }));
    } else {
      runs.push(new TextRun({ text: part }));
    }
  }
  return runs.length ? runs : [new TextRun({ text: "" })];
}

const children = [];
let titleDone = false;
let inTable = false;
let tableRows = [];

function flushTable() {
  if (!inTable) return;
  inTable = false;
  // Render rows as pipe-delimited paragraphs; keeps the generator simple
  // and never loses data.
  for (const row of tableRows) {
    children.push(
      new Paragraph({
        children: inlineRuns(row),
        spacing: { after: 60 },
      }),
    );
  }
  tableRows = [];
}

for (const raw of lines) {
  const line = raw.trim();

  // Table block
  if (line.startsWith("|")) {
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    // skip separator rows like |---|---|
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    inTable = true;
    tableRows.push(cells.join("  |  "));
    continue;
  }

  flushTable();

  if (!line) continue;

  if (line.startsWith("# ") && !titleDone) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: line.slice(2).trim(), bold: true, size: 36 })],
        spacing: { after: 240 },
      }),
    );
    titleDone = true;
    continue;
  }

  const h = /^(#{2,6})\s+(.*)$/.exec(line);
  if (h) {
    const level = Math.min(h[1].length - 1, 6);
    children.push(
      new Paragraph({
        heading: [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
                  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][
                  level - 1
                ],
        children: inlineRuns(h[2]),
      }),
    );
    continue;
  }

  if (/^(-{3,}|\*{3,})$/.test(line)) {
    children.push(new Paragraph({ border: { bottom: { style: "single", size: 6 } }, spacing: { after: 160 } }));
    continue;
  }

  const bullet = /^[-*]\s+(.*)$/.exec(line);
  if (bullet) {
    children.push(
      new Paragraph({ bullet: { level: 1 }, children: inlineRuns(bullet[1]), spacing: { after: 40 } }),
    );
    continue;
  }

  const ordered = /^(\d+)\.\s+(.*)$/.exec(line);
  if (ordered) {
    children.push(
      new Paragraph({ bullet: { level: 1 }, children: inlineRuns(ordered[2]), spacing: { after: 40 } }),
    );
    continue;
  }

  if (/^>\s?/.test(line)) {
    children.push(
      new Paragraph({
        children: inlineRuns(line.replace(/^>\s?/, "")),
        indent: { left: 360 },
        italics: true,
        spacing: { after: 80 },
      }),
    );
    continue;
  }

  children.push(new Paragraph({ children: inlineRuns(line), spacing: { after: 80 } }));
}

flushTable();

const doc = new Document({
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 22 } },
    },
  },
  sections: [
    {
      properties: {},
      children,
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, buffer);
console.log(`Scris: ${outPath} (${buffer.length} bytes)`);
