import test from "node:test";
import assert from "node:assert/strict";
import {
  ARCHIVE_VIEWER_LAYOUT_DUAL,
  ARCHIVE_VIEWER_LAYOUT_SINGLE,
  buildDualViewerCaption,
  normalizeArchiveViewerLayout,
  resolveAdjacentDualPairStart,
  resolveDualPair,
} from "../archive-viewer-layout-core.mjs";

test("보관함 확대 보기 방식은 단일 보기를 기본값으로 사용한다", () => {
  assert.equal(normalizeArchiveViewerLayout("DUAL"), ARCHIVE_VIEWER_LAYOUT_DUAL);
  assert.equal(normalizeArchiveViewerLayout("SINGLE"), ARCHIVE_VIEWER_LAYOUT_SINGLE);
  assert.equal(normalizeArchiveViewerLayout("UNKNOWN"), ARCHIVE_VIEWER_LAYOUT_SINGLE);
});

test("2장보기는 누른 이미지와 다음 이미지를 좌우 한 쌍으로 만든다", () => {
  assert.deepEqual(resolveDualPair(0, 5), [0, 1]);
  assert.deepEqual(resolveDualPair(2, 5), [2, 3]);
});

test("마지막 이미지를 누르면 직전 이미지와 함께 두 장을 표시한다", () => {
  assert.deepEqual(resolveDualPair(4, 5), [3, 4]);
  assert.deepEqual(resolveDualPair(0, 1), [0]);
});

test("2장보기 이동은 두 장 단위로 이동하고 범위를 넘지 않는다", () => {
  assert.equal(resolveAdjacentDualPairStart(0, 6, 1), 2);
  assert.equal(resolveAdjacentDualPairStart(2, 6, 1), 4);
  assert.equal(resolveAdjacentDualPairStart(4, 6, 1), 4);
  assert.equal(resolveAdjacentDualPairStart(2, 6, -1), 0);
});

test("2장보기 캡션은 왼쪽 프롬프트 제목 하나와 외 1만 표시한다", () => {
  const items = [
    { promptTitle: "첫 프롬프트" },
    { promptTitle: "첫 프롬프트" },
    { promptTitle: "둘째 프롬프트" },
  ];
  assert.equal(buildDualViewerCaption(items, [0, 1]), "1–2 / 3 · 첫 프롬프트 외 1");
  assert.equal(buildDualViewerCaption(items, [1, 2]), "2–3 / 3 · 첫 프롬프트 외 1");
  assert.equal(buildDualViewerCaption(items, [2]), "3 / 3 · 둘째 프롬프트");
});
