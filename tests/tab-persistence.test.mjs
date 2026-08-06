import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTab,
  resolveRestoredTab,
} from "../tab-persistence.js";

test("지원하는 탭 경로를 그대로 유지한다", () => {
  assert.equal(normalizeTab("library"), "library");
  assert.equal(normalizeTab("archive"), "archive");
  assert.equal(normalizeTab("settings"), "settings");
});

test("잘못된 탭 경로는 기본 탭으로 대체한다", () => {
  assert.equal(normalizeTab("unknown"), "library");
  assert.equal(normalizeTab(null), "library");
});

test("저장된 마지막 탭을 복원하고 잘못된 값은 대체한다", () => {
  assert.equal(resolveRestoredTab("archive"), "archive");
  assert.equal(resolveRestoredTab("invalid", "settings"), "settings");
});
