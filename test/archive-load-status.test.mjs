import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("보관함은 점진 로딩 상태와 추가 로드 안내를 표시한다", async () => {
  const source = await read("ui-enhancements.js");
  assert.match(source, /archiveLoadMoreStatus/);
  assert.match(source, /목록 끝에서 위로 밀어 더 불러오기/);
  assert.match(source, /로드 \$\{archiveImages\.length\} \/ \$\{archiveTotals\.imageCount\}장/);
});
