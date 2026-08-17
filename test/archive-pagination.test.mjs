import test from "node:test";
import assert from "node:assert/strict";
import {
  getArchiveTotals,
  prepareArchiveSummaries,
  takeArchiveSummaryBatch,
} from "../archive-pagination-core.mjs";

test("보관함 요약은 이미지가 있고 선택된 LLM인 항목만 최근 수정순으로 정렬한다", () => {
  const summaries = [
    { id: 1, llmType: "CHATGPT", imageCount: 3, updatedAt: 100 },
    { id: 2, llmType: "GEMINI", imageCount: 4, updatedAt: 300 },
    { id: 3, llmType: "CHATGPT", imageCount: 0, updatedAt: 500 },
    { id: 4, llmType: "CHATGPT", imageCount: 2, updatedAt: 200 },
  ];

  const prepared = prepareArchiveSummaries(summaries, new Set(["CHATGPT"]));
  assert.deepEqual(prepared.map(({ id }) => id), [4, 1]);
  assert.deepEqual(getArchiveTotals(prepared), { promptCount: 2, imageCount: 5 });
});

test("보관함 페이지는 약 24장까지만 선택하고 다음 위치를 반환한다", () => {
  const summaries = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    imageCount: 5,
  }));

  const first = takeArchiveSummaryBatch(summaries, 0);
  assert.equal(first.batch.length, 5);
  assert.equal(first.expectedImageCount, 25);
  assert.equal(first.nextIndex, 5);
  assert.equal(first.hasMore, true);

  const second = takeArchiveSummaryBatch(summaries, first.nextIndex);
  assert.equal(second.batch[0].id, 6);
  assert.equal(second.nextIndex, 10);
});

test("이미지가 적은 프롬프트가 많아도 한 번에 최대 12개 레코드만 요청한다", () => {
  const summaries = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    imageCount: 1,
  }));

  const page = takeArchiveSummaryBatch(summaries, 0);
  assert.equal(page.batch.length, 12);
  assert.equal(page.expectedImageCount, 12);
  assert.equal(page.nextIndex, 12);
  assert.equal(page.hasMore, true);
});
