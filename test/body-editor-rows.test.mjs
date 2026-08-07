import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const index = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("본문 입력란은 7행으로 표시한다", () => {
  assert.match(index, /<textarea id="promptContentInput" rows="7" required><\/textarea>/);
});
