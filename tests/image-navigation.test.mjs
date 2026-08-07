import test from "node:test";
import assert from "node:assert/strict";
import {
  buildViewerCaption,
  getSwipeDirection,
  getSwipeDragOffset,
  resolveAdjacentIndex,
} from "../image-navigation.js";

test("가로 스와이프 방향을 판정한다", () => {
  assert.equal(getSwipeDirection(200, 100, 100, 110), 1);
  assert.equal(getSwipeDirection(100, 100, 200, 90), -1);
});

test("짧거나 세로 중심 제스처는 스와이프로 처리하지 않는다", () => {
  assert.equal(getSwipeDirection(100, 100, 70, 102), 0);
  assert.equal(getSwipeDirection(100, 100, 30, 190), 0);
});

test("이전과 다음 인덱스는 배열 경계를 넘지 않는다", () => {
  assert.equal(resolveAdjacentIndex(1, 3, 1), 2);
  assert.equal(resolveAdjacentIndex(2, 3, 1), 2);
  assert.equal(resolveAdjacentIndex(0, 3, -1), 0);
});

test("이동 가능한 방향은 손가락 이동량을 그대로 사용한다", () => {
  assert.equal(getSwipeDragOffset(-120, true), -120);
  assert.equal(getSwipeDragOffset(80, true), 80);
});

test("목록 경계에서는 스와이프 이동량에 저항을 적용한다", () => {
  assert.ok(Math.abs(getSwipeDragOffset(-100, false) + 28) < Number.EPSILON * 32);
  assert.equal(getSwipeDragOffset(100, false, 0.4), 40);
});

test("뷰어 캡션은 현재 범위 순번과 제목·메타정보를 사용하고 파일명은 제외한다", () => {
  assert.equal(
    buildViewerCaption(
      { promptTitle: "테스트", imageName: "사진.png" },
      1,
      3,
      "비율 9:16 · 1080×1920",
    ),
    "2 / 3 · 테스트 · 비율 9:16 · 1080×1920",
  );
  assert.equal(
    buildViewerCaption(
      { promptTitle: "", imageName: "사진.png" },
      0,
      2,
      "비율 3:4 · 1080×1440",
    ),
    "1 / 2 · 비율 3:4 · 1080×1440",
  );
});
