import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("카드 즐겨찾기는 Enter와 Space 키 입력을 처리한다", async () => {
  const script = await readFile(new URL("../card-favorite.js", import.meta.url), "utf8");
  assert.match(script, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(script, /promptList\.addEventListener\("keydown", handleFavoriteKeydown, true\)/);
});
