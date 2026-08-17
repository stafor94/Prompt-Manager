import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const OLD_VERSION = "1.5.5";
const NEW_VERSION = "1.5.6";

function replaceRequired(source, search, replacement, file) {
  if (!source.includes(search)) {
    throw new Error(`${file}: expected text not found: ${search.slice(0, 100)}`);
  }
  return source.replace(search, replacement);
}

async function update(file, transform) {
  const source = await readFile(file, "utf8");
  const next = transform(source);
  if (next === source) throw new Error(`${file}: no changes produced`);
  await writeFile(file, next);
}

const versionFiles = [
  "archive-six-columns.js",
  "archive-viewer-layout.js",
  "index.html",
  "library-controls.js",
  "prompt-organization-backup.js",
  "sw.js",
  "ui-enhancements.js",
  "version-display.js",
];

for (const file of versionFiles) {
  await update(file, (source) => source.replaceAll(OLD_VERSION, NEW_VERSION));
}

await update("sw.js", (source) => replaceRequired(
  source,
  'const CACHE_NAME = "prompt-manager-shell-v49";',
  'const CACHE_NAME = "prompt-manager-shell-v50";',
  "sw.js",
));

await update("archive-pagination-core.mjs", (source) => {
  const marker = "export function getArchiveTotals(summaries) {";
  const helper = `export function splitArchiveImagesForFilledRows(\n  images,\n  currentImageCount,\n  columnCount,\n  hasMoreImages,\n) {\n  const source = Array.isArray(images) ? images : [];\n  const current = Number.isInteger(currentImageCount) && currentImageCount >= 0 ? currentImageCount : 0;\n  const requestedColumns = Number(columnCount);\n  const columns = [2, 3, 4, 6].includes(requestedColumns) ? requestedColumns : 3;\n\n  if (!hasMoreImages) {\n    return { visibleImages: [...source], pendingImages: [] };\n  }\n\n  const currentRemainder = current % columns;\n  let visibleCount = 0;\n  if (currentRemainder > 0) {\n    const neededToFillRow = columns - currentRemainder;\n    if (source.length >= neededToFillRow) visibleCount = neededToFillRow;\n  } else {\n    visibleCount = source.length - (source.length % columns);\n  }\n\n  return {\n    visibleImages: source.slice(0, visibleCount),\n    pendingImages: source.slice(visibleCount),\n  };\n}\n\n`;
  return replaceRequired(source, marker, `${helper}${marker}`, "archive-pagination-core.mjs");
});

await update("ui-enhancements.js", (source) => {
  let next = source;
  next = replaceRequired(
    next,
    "  prepareArchiveSummaries,\n  takeArchiveSummaryBatch,\n",
    "  prepareArchiveSummaries,\n  splitArchiveImagesForFilledRows,\n  takeArchiveSummaryBatch,\n",
    "ui-enhancements.js",
  );
  next = replaceRequired(
    next,
    'const ARCHIVE_COLUMN_OPTIONS = new Set(["2", "3", "4"]);',
    'const ARCHIVE_COLUMN_OPTIONS = new Set(["2", "3", "4", "6"]);',
    "ui-enhancements.js",
  );
  next = replaceRequired(
    next,
    "let archiveImages = [];\nlet archiveSummaries = [];",
    "let archiveImages = [];\nlet archivePendingImages = [];\nlet archiveSummaries = [];",
    "ui-enhancements.js",
  );
  next = replaceRequired(
    next,
    "  saveArchiveColumns(resolved);\n}\n\nfunction setArchiveMode(mode) {",
    "  saveArchiveColumns(resolved);\n  window.dispatchEvent(new CustomEvent(\"prompt-manager:archive-columns-change\", { detail: { columns: resolved } }));\n}\n\nfunction setArchiveMode(mode) {",
    "ui-enhancements.js",
  );
  next = replaceRequired(
    next,
    "function archiveHasMore() {\n  return archiveNextSummaryIndex < archiveSummaries.length;\n}\n",
    `function getArchiveColumnCount() {\n  const value = Number(document.querySelector(\"#imageArchiveGrid\")?.dataset.columns);\n  return [2, 3, 4, 6].includes(value) ? value : 3;\n}\n\nfunction archiveHasMore() {\n  return archivePendingImages.length > 0 || archiveNextSummaryIndex < archiveSummaries.length;\n}\n\nfunction requestArchiveRowFill() {\n  if (!archiveActive || archiveLoading || !archiveHasMore()) return;\n  if (archiveImages.length % getArchiveColumnCount() === 0) return;\n  loadNextArchiveBatch().catch((error) => console.error(error instanceof Error ? error.message : \"이미지 행 채우기 오류\"));\n}\n`,
    "ui-enhancements.js",
  );

  const oldLoader = `async function loadNextArchiveBatch(expectedGeneration = archiveGeneration) {\n  if (!archiveActive || archiveLoading || !archiveHasMore()) return;\n\n  const page = takeArchiveSummaryBatch(archiveSummaries, archiveNextSummaryIndex);\n  if (page.batch.length === 0) {\n    archiveNextSummaryIndex = page.nextIndex;\n    updateArchiveUi();\n    return;\n  }\n\n  archiveLoading = true;\n  updateArchiveUi();\n\n  try {\n    const records = await getPromptRecords(page.batch.map((summary) => summary.id));\n    if (!archiveActive || expectedGeneration !== archiveGeneration) return;\n    appendArchiveImages(buildArchiveImages(records));\n    archiveNextSummaryIndex = page.nextIndex;\n  } finally {\n    if (expectedGeneration === archiveGeneration) {\n      archiveLoading = false;\n      updateArchiveUi();\n    }\n  }\n}\n`;
  const newLoader = `async function loadNextArchiveBatch(expectedGeneration = archiveGeneration) {\n  if (!archiveActive || archiveLoading || !archiveHasMore()) return;\n\n  archiveLoading = true;\n  updateArchiveUi();\n\n  try {\n    while (archiveActive && expectedGeneration === archiveGeneration) {\n      const hasMoreSummaries = archiveNextSummaryIndex < archiveSummaries.length;\n      const split = splitArchiveImagesForFilledRows(\n        archivePendingImages,\n        archiveImages.length,\n        getArchiveColumnCount(),\n        hasMoreSummaries,\n      );\n      archivePendingImages = split.pendingImages;\n\n      if (split.visibleImages.length > 0) {\n        appendArchiveImages(split.visibleImages);\n        break;\n      }\n      if (!hasMoreSummaries) break;\n\n      const page = takeArchiveSummaryBatch(archiveSummaries, archiveNextSummaryIndex);\n      if (page.batch.length === 0) {\n        archiveNextSummaryIndex = page.nextIndex;\n        continue;\n      }\n\n      const records = await getPromptRecords(page.batch.map((summary) => summary.id));\n      if (!archiveActive || expectedGeneration !== archiveGeneration) return;\n      archivePendingImages.push(...buildArchiveImages(records));\n      archiveNextSummaryIndex = page.nextIndex;\n    }\n  } finally {\n    if (expectedGeneration === archiveGeneration) {\n      archiveLoading = false;\n      updateArchiveUi();\n    }\n  }\n}\n`;
  next = replaceRequired(next, oldLoader, newLoader, "ui-enhancements.js");
  next = replaceRequired(
    next,
    "  archiveLoading = true;\n  archiveImages = [];\n  archiveSummaries = [];",
    "  archiveLoading = true;\n  archiveImages = [];\n  archivePendingImages = [];\n  archiveSummaries = [];",
    "ui-enhancements.js",
  );
  next = replaceRequired(
    next,
    "  archiveImages = [];\n  archiveSummaries = [];\n  archiveNextSummaryIndex = 0;\n  archiveTotals = { promptCount: 0, imageCount: 0 };\n  archiveDirty = true;",
    "  archiveImages = [];\n  archivePendingImages = [];\n  archiveSummaries = [];\n  archiveNextSummaryIndex = 0;\n  archiveTotals = { promptCount: 0, imageCount: 0 };\n  archiveDirty = true;",
    "ui-enhancements.js",
  );
  next = replaceRequired(
    next,
    '  window.addEventListener("prompt-manager:archive-llm-filter-change", scheduleArchiveRefresh);',
    '  window.addEventListener("prompt-manager:archive-llm-filter-change", scheduleArchiveRefresh);\n  window.addEventListener("prompt-manager:archive-columns-change", requestArchiveRowFill);',
    "ui-enhancements.js",
  );
  return next;
});

await update("archive-six-columns.js", (source) => replaceRequired(
  source,
  '    applyArchiveColumns("6");\n  });',
  '    applyArchiveColumns("6");\n    window.dispatchEvent(new CustomEvent("prompt-manager:archive-columns-change", { detail: { columns: "6" } }));\n  });',
  "archive-six-columns.js",
));

await update("archive-grouping.css", (source) => {
  let next = replaceRequired(source, "  min-height: 58px;", "  min-height: 46px;", "archive-grouping.css");
  next = replaceRequired(next, "  padding: 8px 0 18px;", "  padding: 4px 0 2px;", "archive-grouping.css");
  return next;
});

await update("CHANGELOG.md", (source) => replaceRequired(
  source,
  "현재 예정된 변경 사항이 없습니다.\n\n\n## [1.5.5] - 2026-08-17",
  `현재 예정된 변경 사항이 없습니다.\n\n\n## [1.5.6] - 2026-08-17\n\n### 수정\n\n- 보관함 점진 로딩 시 선택된 2·3·4·6열 기준으로 화면에 표시되는 마지막 행이 채워지도록 이미지 묶음을 정렬해 렌더링합니다.\n- 한 프롬프트에서 필요한 수보다 많은 이미지를 읽은 경우 남는 이미지는 메모리에 잠시 보류하고 다음 추가 로드에 이어 사용해 불필요한 IndexedDB 재읽기를 피합니다.\n- 열 수를 변경했을 때 현재 마지막 행이 비어 있으면 남은 이미지가 있는 경우 필요한 수만 추가로 표시해 행을 채웁니다. 실제 데이터가 끝난 마지막 행은 이미지 누락 없이 그대로 표시합니다.\n- 하단 추가 로드 스와이프 아이콘의 아래쪽 여백을 줄여 이미지 목록과 하단 영역 사이 간격을 더 촘촘하게 조정했습니다.\n\n### 테스트\n\n- 2·3·4·6열에서 25장 중 24장만 먼저 표시하고 1장을 다음 로드로 보류하는 행 정렬 동작을 검증하는 테스트를 추가했습니다.\n- 열 수 변경 시 부족한 칸만 채우는 동작과 마지막 데이터에서는 남은 이미지를 모두 표시하는 동작을 검증합니다.\n- 앱 버전과 Service Worker 캐시를 \`v1.5.6\` / \`v50\` 기준으로 갱신했습니다.\n\n## [1.5.5] - 2026-08-17`,
  "CHANGELOG.md",
));

await update("release-notes.js", (source) => {
  let next = replaceRequired(source, 'const APP_VERSION = "1.5.5";', 'const APP_VERSION = "1.5.6";', "release-notes.js");
  next = replaceRequired(
    next,
    "const FALLBACK_CHANGELOG = `\n## [1.5.5] - 2026-08-17",
    `const FALLBACK_CHANGELOG = \`\n## [1.5.6] - 2026-08-17\n\n### 수정\n\n- 보관함 추가 로드는 선택된 2·3·4·6열에 맞춰 마지막 표시 행이 채워지도록 정렬합니다.\n- 열 수 변경 후 마지막 행에 빈 칸이 생기면 남은 이미지가 있는 경우 필요한 수만 이어서 표시합니다.\n- 실제 데이터의 마지막 행은 이미지 누락 없이 모두 표시합니다.\n- 하단 위로 스와이프 안내 아이콘의 아래 여백을 더 줄였습니다.\n\n## [1.5.5] - 2026-08-17`,
    "release-notes.js",
  );
  return next;
});

const testDir = "test";
for (const entry of await readdir(testDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".mjs")) continue;
  const file = path.join(testDir, entry.name);
  const source = await readFile(file, "utf8");
  const next = source
    .replaceAll("1.5.5", "1.5.6")
    .replaceAll("1\\.5\\.5", "1\\.5\\.6")
    .replaceAll("shell-v49", "shell-v50");
  if (next !== source) await writeFile(file, next);
}

await writeFile("test/archive-row-fill.test.mjs", `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport { splitArchiveImagesForFilledRows } from "../archive-pagination-core.mjs";\n\nfunction images(count) {\n  return Array.from({ length: count }, (_, index) => ({ index }));\n}\n\ntest("2·3·4·6열 모두 추가 데이터가 있으면 마지막 표시 행을 완전히 채운다", () => {\n  for (const columns of [2, 3, 4, 6]) {\n    const result = splitArchiveImagesForFilledRows(images(25), 0, columns, true);\n    assert.equal(result.visibleImages.length, 24, \`${"${columns}"}열 표시 수\`);\n    assert.equal(result.pendingImages.length, 1, \`${"${columns}"}열 보류 수\`);\n    assert.equal(result.visibleImages.length % columns, 0);\n  }\n});\n\ntest("열 수 변경으로 기존 마지막 행이 비면 필요한 이미지만 이어 붙인다", () => {\n  const result = splitArchiveImagesForFilledRows(images(8), 16, 6, true);\n  assert.equal(result.visibleImages.length, 2);\n  assert.equal(result.pendingImages.length, 6);\n  assert.equal((16 + result.visibleImages.length) % 6, 0);\n});\n\ntest("실제 데이터가 끝나면 마지막 행이 덜 차더라도 남은 이미지를 모두 표시한다", () => {\n  const result = splitArchiveImagesForFilledRows(images(5), 24, 6, false);\n  assert.equal(result.visibleImages.length, 5);\n  assert.equal(result.pendingImages.length, 0);\n});\n\ntest("보관함 UI는 6열을 포함한 현재 열 수와 보류 이미지를 사용하고 안내 아이콘 아래 여백을 줄인다", async () => {\n  const [ui, sixColumns, css] = await Promise.all([\n    readFile(new URL("../ui-enhancements.js", import.meta.url), "utf8"),\n    readFile(new URL("../archive-six-columns.js", import.meta.url), "utf8"),\n    readFile(new URL("../archive-grouping.css", import.meta.url), "utf8"),\n  ]);\n  assert.match(ui, /ARCHIVE_COLUMN_OPTIONS = new Set\\(\\["2", "3", "4", "6"\\]\\)/);\n  assert.match(ui, /archivePendingImages/);\n  assert.match(ui, /splitArchiveImagesForFilledRows/);\n  assert.match(ui, /prompt-manager:archive-columns-change/);\n  assert.match(sixColumns, /prompt-manager:archive-columns-change/);\n  assert.match(css, /min-height:\\s*46px/);\n  assert.match(css, /padding:\\s*4px 0 2px/);\n});\n`, "utf8");
