import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("보관함 추가 로드는 문구 대신 위쪽 스와이프 아이콘을 표시한다", async () => {
  const [ui, css] = await Promise.all([read("ui-enhancements.js"), read("archive-grouping.css")]);
  assert.doesNotMatch(ui, /로드됨 · 목록 끝에서 위로 밀어 더 불러오기/);
  assert.doesNotMatch(ui, /이미지를 불러오는 중입니다/);
  assert.match(ui, /class="archive-load-more-indicator"/);
  assert.match(ui, /class="archive-swipe-cue"/);
  assert.match(ui, /위로 스와이프하면 이미지를 더 불러옵니다/);
  assert.match(ui, /const showSwipeCue = !archiveLoading && archiveHasMore\(\) && hasImages/);
  assert.match(css, /@keyframes archive-swipe-cue-float/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("보관함 상단에는 현재 로드 수가 아니라 전체 이미지 수를 표시한다", async () => {
  const ui = await read("ui-enhancements.js");
  assert.match(ui, /첨부 이미지 \${archiveTotals\.imageCount}장/);
  assert.doesNotMatch(ui, /`로드 \${archiveImages\.length} \/ \${archiveTotals\.imageCount}장/);
});
