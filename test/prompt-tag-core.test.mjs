import test from "node:test";
import assert from "node:assert/strict";

import { collectTagOptions, matchesPromptQuery } from "../prompt-tag-core.mjs";

test("검색은 제목, 본문, 태그만 대상으로 사용한다", () => {
  const prompt = {
    title: "배포 체크리스트",
    content: "캐시 갱신 확인",
    collection: "레거시 컬렉션",
  };

  assert.equal(matchesPromptQuery(prompt, "배포", ["PWA"]), true);
  assert.equal(matchesPromptQuery(prompt, "pwa", ["PWA"]), true);
  assert.equal(matchesPromptQuery(prompt, "레거시", ["PWA"]), false);
});

test("태그 필터 옵션은 사용 횟수와 이름 순으로 정렬한다", () => {
  const options = collectTagOptions([
    { tags: ["PWA", "모바일"] },
    { tags: ["pwa", "백업"] },
  ]);

  assert.deepEqual(options, [
    { label: "PWA", count: 2 },
    { label: "모바일", count: 1 },
    { label: "백업", count: 1 },
  ]);
});
