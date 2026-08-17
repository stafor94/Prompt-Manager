import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("보관함은 진행 문구 대신 추가 로드 스와이프 안내를 표시한다", async () => {
  const source = await read("ui-enhancements.js");
  assert.match(source, /archiveLoadMoreStatus/);
  assert.match(source, /archive-swipe-cue/);
  assert.match(source, /위로 스와이프하면 이미지를 더 불러옵니다/);
  assert.doesNotMatch(source, /로드됨 · 목록 끝에서 위로 밀어 더 불러오기/);
  assert.doesNotMatch(source, /`로드 \${archiveImages\.length} \/ \${archiveTotals\.imageCount}장/);
});
