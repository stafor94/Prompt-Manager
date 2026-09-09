import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("동적으로 스타일을 불러오는 모듈도 1.6.0을 사용한다", async () => {
  const [library, sixColumns, viewer] = await Promise.all([
    read("library-controls.js"),
    read("archive-six-columns.js"),
    read("archive-viewer-layout.js"),
  ]);
  for (const source of [library, sixColumns, viewer]) {
    assert.match(source, /APP_VERSION = "1\.6\.0"/);
    assert.doesNotMatch(source, /APP_VERSION = "1\.5\.3"/);
  }
});

test("1.6.0 변경 이력과 점진 로딩 코어가 앱 셸에 포함된다", async () => {
  const [changelog, sw] = await Promise.all([read("CHANGELOG.md"), read("sw.js")]);
  assert.match(changelog, /## \[1\.6\.0\] - 2026-09-09/);
  assert.match(changelog, /사용자 정의 LLM/);
  assert.match(sw, /prompt-manager-shell-v51/);
  assert.match(sw, /\.\/archive-pagination-core\.mjs/);
});
