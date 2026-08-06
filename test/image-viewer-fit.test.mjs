import test from "node:test";
import assert from "node:assert/strict";

import {
  getViewerScale,
  hasViewerTranslation,
  shouldResetViewerTransform,
} from "../image-viewer-fit-core.mjs";

test("뷰어 배율을 transform 문자열에서 읽는다", () => {
  assert.equal(getViewerScale("translate3d(0, 0, 0) scale(2.5)"), 2.5);
  assert.equal(getViewerScale("none"), 1);
  assert.equal(getViewerScale("scale(invalid)"), 1);
});

test("확대 또는 이동 상태를 초기화 대상으로 판정한다", () => {
  assert.equal(hasViewerTranslation("translate3d(12px, -3px, 0) scale(1)"), true);
  assert.equal(shouldResetViewerTransform("translate3d(0, 0, 0) scale(1)"), false);
  assert.equal(shouldResetViewerTransform("translate3d(0, 0, 0) scale(1.25)"), true);
});
