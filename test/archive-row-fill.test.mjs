import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { splitArchiveImagesForFilledRows } from "../archive-pagination-core.mjs";

function images(count) {
  return Array.from({ length: count }, (_, index) => ({ index }));
}

test("2·3·4·6열 모두 추가 데이터가 있으면 마지막 표시 행을 완전히 채운다", () => {
  for (const columns of [2, 3, 4, 6]) {
    const result = splitArchiveImagesForFilledRows(images(25), 0, columns, true);
    assert.equal(result.visibleImages.length, 24, `${columns}열 표시 수`);
    assert.equal(result.pendingImages.length, 1, `${columns}열 보류 수`);
    assert.equal(result.visibleImages.length % columns, 0);
  }
});

test("열 수 변경으로 기존 마지막 행이 비면 필요한 이미지만 이어 붙인다", () => {
  const result = splitArchiveImagesForFilledRows(images(8), 16, 6, true);
  assert.equal(result.visibleImages.length, 2);
  assert.equal(result.pendingImages.length, 6);
  assert.equal((16 + result.visibleImages.length) % 6, 0);
});

test("실제 데이터가 끝나면 마지막 행이 덜 차더라도 남은 이미지를 모두 표시한다", () => {
  const result = splitArchiveImagesForFilledRows(images(5), 24, 6, false);
  assert.equal(result.visibleImages.length, 5);
  assert.equal(result.pendingImages.length, 0);
});

test("보관함 UI는 6열을 포함한 현재 열 수와 보류 이미지를 사용하고 안내 아이콘 아래 여백을 줄인다", async () => {
  const [ui, sixColumns, css] = await Promise.all([
    readFile(new URL("../ui-enhancements.js", import.meta.url), "utf8"),
    readFile(new URL("../archive-six-columns.js", import.meta.url), "utf8"),
    readFile(new URL("../archive-grouping.css", import.meta.url), "utf8"),
  ]);
  assert.match(ui, /ARCHIVE_COLUMN_OPTIONS = new Set\(\["2", "3", "4", "6"\]\)/);
  assert.match(ui, /archivePendingImages/);
  assert.match(ui, /splitArchiveImagesForFilledRows/);
  assert.match(ui, /prompt-manager:archive-columns-change/);
  assert.match(sixColumns, /prompt-manager:archive-columns-change/);
  assert.match(css, /min-height:\s*46px/);
  assert.match(css, /padding:\s*4px 0 2px/);
});
