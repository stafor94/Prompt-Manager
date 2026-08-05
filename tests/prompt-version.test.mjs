import assert from "node:assert/strict";
import {
  assignPromptVersions,
  getNextPromptVersion,
  getPromptVersion,
  normalizePromptTitle,
  resolvePromptVersion,
} from "../prompt-version.mjs";

assert.equal(normalizePromptTitle("  같은 제목  "), "같은 제목");
assert.equal(normalizePromptTitle("e\u0301"), "é");

const migrated = assignPromptVersions([
  { id: 2, title: "제목", createdAt: 200 },
  { id: 1, title: "제목", createdAt: 100 },
  { id: 3, title: "다른 제목", createdAt: 300 },
]);

assert.deepEqual(migrated.prompts.map((prompt) => prompt.version), [2, 1, 1]);
assert.deepEqual(migrated.changedIndexes, [0, 1, 2]);

const preserved = assignPromptVersions([
  { id: 1, title: "제목", createdAt: 100, version: 1 },
  { id: 2, title: "제목", createdAt: 200, version: 2 },
  { id: 3, title: "제목", createdAt: 300, version: 2 },
]);

assert.deepEqual(preserved.prompts.map((prompt) => prompt.version), [1, 2, 3]);
assert.deepEqual(preserved.changedIndexes, [2]);

assert.equal(getNextPromptVersion(preserved.prompts, "제목"), 4);
assert.equal(getNextPromptVersion(preserved.prompts, "새 제목"), 1);
assert.equal(getNextPromptVersion(preserved.prompts, " 제목 ", 3), 3);
assert.equal(getPromptVersion({ version: 7 }), 7);
assert.equal(getPromptVersion({}), 1);
assert.equal(resolvePromptVersion(preserved.prompts, "제목", preserved.prompts[0]), 1);
assert.equal(resolvePromptVersion(preserved.prompts, "새 제목", preserved.prompts[0]), 1);
assert.equal(resolvePromptVersion(preserved.prompts, "제목", null), 4);
assert.equal(resolvePromptVersion([
  { id: 1, llmType: "CHATGPT", title: "공통", version: 1 },
], "공통", null), 2);

console.log("prompt version tests passed");
