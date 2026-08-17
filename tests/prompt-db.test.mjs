import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPromptSummary } from "../prompt-db.mjs";

test("목록용 요약은 이미지 본문을 제외하고 개수만 유지한다", () => {
  const source = {
    id: 7,
    llmType: "CHATGPT",
    title: "제목",
    content: "첫 줄\n둘째 줄",
    images: [
      { id: "a", dataUrl: "data:image/png;base64,AAAA" },
      { id: "b", dataUrl: "data:image/jpeg;base64,BBBB" },
    ],
    tags: ["업무", "긴 글"],
    version: 3,
    createdAt: 10,
    updatedAt: 20,
    isFavorite: true,
  };

  const summary = buildPromptSummary(source);
  assert.equal(summary.content, source.content);
  assert.equal(summary.imageCount, 2);
  assert.deepEqual(summary.tags, source.tags);
  assert.equal(summary.version, 3);
  assert.equal("images" in summary, false);
  assert.equal(JSON.stringify(summary).includes("base64"), false);
});

test("성능 경로는 목록과 보관함 필터에서 전체 이미지 DB 재읽기를 피한다", async () => {
  const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const [app, organization, archive, archiveFilter, favorite] = await Promise.all([
    read("app.js"), read("prompt-organization-backup.js"), read("ui-enhancements.js"),
    read("archive-llm-filter.js"), read("card-favorite.js"),
  ]);

  assert.match(app, /getAllPromptSummaries/);
  assert.match(organization, /getAllPromptSummaries/);
  assert.match(archive, /if \(!archiveActive\) return;/);
  assert.match(archive, /archiveImages = \[\];/);
  assert.doesNotMatch(archiveFilter, /indexedDB\.open|getAll\(/);
  assert.match(favorite, /putPromptRecord/);
});
