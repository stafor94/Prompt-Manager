import test from "node:test";
import assert from "node:assert/strict";

import {
  formatAspectRatio,
  formatImageMetadata,
  formatResolution,
  greatestCommonDivisor,
} from "../image-metadata.mjs";

test("해상도 최대공약수로 이미지 비율을 단순화한다", () => {
  assert.equal(greatestCommonDivisor(1080, 1440), 360);
  assert.equal(formatAspectRatio(1080, 1440), "3:4");
  assert.equal(formatAspectRatio(1080, 1920), "9:16");
  assert.equal(formatAspectRatio(4032, 3024), "4:3");
});

test("이미지 해상도 뒤에 비율을 괄호로 표시한다", () => {
  assert.equal(formatResolution(1080, 1920), "1080×1920");
  assert.equal(formatImageMetadata(1080, 1920), "1080×1920(9:16)");
  assert.equal(formatImageMetadata(720, 1080), "720×1080(2:3)");
});

test("유효하지 않은 이미지 크기는 빈 정보로 처리한다", () => {
  assert.equal(formatAspectRatio(0, 1920), "");
  assert.equal(formatResolution(1080, 0), "");
  assert.equal(formatImageMetadata(undefined, undefined), "");
});
