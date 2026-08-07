import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("숨겨진 즐겨찾기 필드는 기존 편집 저장 로직과 연결되어 상태를 보존한다", async () => {
  const [index, app] = await Promise.all([
    read("index.html"),
    read("app.js"),
  ]);

  assert.match(index, /id="promptFavoriteInput" class="visually-hidden"/);
  assert.match(app, /elements\.promptFavoriteInput\.checked = asDuplicate \? false : \(prompt\?\.isFavorite \?\? false\)/);
  assert.match(app, /isFavorite: elements\.promptFavoriteInput\.checked/);
});
