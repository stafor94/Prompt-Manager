import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("설정과 편집기 및 필터가 사용자 정의 LLM 레지스트리에 연결된다", async () => {
  const [index, app, filter, archive, organization] = await Promise.all([
    read("index.html"), read("app.js"), read("llm-filter.js"), read("archive-llm-filter.js"), read("prompt-organization-backup.js"),
  ]);
  assert.match(index, /id="customLlmForm"/);
  assert.match(index, /maxlength="10"/);
  assert.match(app, /getAllCustomLlmRecords/);
  assert.match(app, /isKnownLlmType\(llmType, state\.customLlms\)/);
  assert.match(filter, /getLlmDefinitions/);
  assert.match(archive, /getLlmDefinitions/);
  assert.match(organization, /customLlms:state\.customLlms/);
});

test("1.6.0 정적 자산과 LLM 레지스트리가 새 Service Worker 캐시에 포함된다", async () => {
  const [index, sw, changelog] = await Promise.all([read("index.html"), read("sw.js"), read("CHANGELOG.md")]);
  assert.match(index, /v1\.6\.0/);
  assert.match(sw, /prompt-manager-shell-v51/);
  assert.match(sw, /\.\/llm-registry\.mjs/);
  assert.match(changelog, /## \[1\.6\.0\] - 2026-09-09/);
});
