import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("즐겨찾기 카드 자산은 1.5.2 앱 셸에 포함된다", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /prompt-manager-shell-v46/);
  assert.match(sw, /\.\/card-favorite\.js\?v=1\.5\.2/);
  assert.match(sw, /\.\/card-favorite-core\.mjs/);
  assert.match(sw, /\.\/favorite-editor-ui\.css\?v=1\.5\.2/);
});
