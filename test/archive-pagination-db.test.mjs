import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("보관함 배치 조회는 하나의 readonly 트랜잭션에서 필요한 id만 읽는다", async () => {
  const source = await read("prompt-db.mjs");
  const functionSource = source.match(/export async function getPromptRecords\([\s\S]*?\n}\n\nexport async function putPromptRecord/)?.[0] ?? "";
  assert.ok(functionSource, "getPromptRecords 함수를 찾을 수 없습니다.");
  assert.match(functionSource, /db\.transaction\(PROMPT_STORE, "readonly"\)/);
  assert.match(functionSource, /normalizedIds\.map\(\(id\) => requestToPromise\(store\.get\(id\)\)\)/);
  assert.doesNotMatch(functionSource, /getAll\(/);
});
