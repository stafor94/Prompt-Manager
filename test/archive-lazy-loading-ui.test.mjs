import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("보관함은 전체 프롬프트 원본 대신 요약과 배치 레코드를 사용한다", async () => {
  const source = await read("ui-enhancements.js");
  assert.match(source, /getAllPromptSummaries/);
  assert.match(source, /getPromptRecords/);
  assert.match(source, /takeArchiveSummaryBatch/);
  assert.doesNotMatch(source, /getAllPromptRecords/);
});

test("보관함은 목록 끝에서 위로 스와이프할 때 다음 묶음을 요청한다", async () => {
  const source = await read("ui-enhancements.js");
  assert.match(source, /ARCHIVE_PULL_THRESHOLD\s*=\s*36/);
  assert.match(source, /window\.addEventListener\("touchmove"/);
  assert.match(source, /archiveTouchStartY - currentY < ARCHIVE_PULL_THRESHOLD/);
  assert.match(source, /isDocumentAtBottom\(\)/);
  assert.match(source, /loadNextArchiveBatch\(\)/);
});

test("보관함 LLM 필터 변경은 점진 로딩 목록을 다시 구성한다", async () => {
  const [gallery, filter] = await Promise.all([
    read("ui-enhancements.js"),
    read("archive-llm-filter.js"),
  ]);
  assert.match(filter, /prompt-manager:archive-llm-filter-change/);
  assert.match(gallery, /addEventListener\("prompt-manager:archive-llm-filter-change", scheduleArchiveRefresh\)/);
});
