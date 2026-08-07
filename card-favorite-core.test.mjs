import test from "node:test";
import assert from "node:assert/strict";
import { togglePromptFavorite } from "./card-favorite-core.mjs";

test("즐겨찾기 토글은 즐겨찾기와 수정 일시만 변경한다", () => {
  const original = {
    id: 7,
    llmType: "CHATGPT",
    title: "제목",
    content: "본문\n원문",
    isFavorite: false,
    createdAt: 100,
    updatedAt: 200,
    tags: ["태그"],
    images: [{ id: "image-1", dataUrl: "data:image/png;base64,AA==" }],
  };

  const updated = togglePromptFavorite(original, 300);

  assert.equal(updated.isFavorite, true);
  assert.equal(updated.updatedAt, 300);
  assert.equal(updated.createdAt, 100);
  assert.equal(updated.content, original.content);
  assert.deepEqual(updated.tags, original.tags);
  assert.deepEqual(updated.images, original.images);
  assert.equal(original.isFavorite, false);
  assert.equal(original.updatedAt, 200);
});

test("즐겨찾기 상태를 다시 토글하면 해제한다", () => {
  const updated = togglePromptFavorite({ isFavorite: true, updatedAt: 1 }, 2);
  assert.equal(updated.isFavorite, false);
  assert.equal(updated.updatedAt, 2);
});
