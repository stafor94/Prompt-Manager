import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createBackupZip, parseBackupZip } from "../prompt-organization-backup-core.mjs";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function promptWithImages(count) {
  return {
    llmType: "CHATGPT",
    title: "이미지 한도 테스트",
    content: "본문",
    createdAt: 1,
    updatedAt: 1,
    isFavorite: false,
    images: Array.from({ length: count }, (_, index) => ({
      id: `image-${index + 1}`,
      name: `image-${index + 1}.png`,
      type: "image/png",
      dataUrl: "data:image/png;base64,AA==",
    })),
  };
}

test("편집기와 백업 검증은 이미지 최대 10장 기준을 사용한다", async () => {
  const [app, index, backup] = await Promise.all([
    read("app.js"),
    read("index.html"),
    read("prompt-organization-backup-core.mjs"),
  ]);
  assert.match(app, /const MAX_IMAGES = 10;/);
  assert.match(backup, /export const MAX_IMAGES = 10;/);
  assert.match(index, /id="editorImageCount">0 \/ 10장/);
  assert.match(index, /이미지를 최대 10장까지 첨부할 수 있습니다\./);
});

test("10장 이미지는 ZIP 백업에서 왕복하고 11장은 거부한다", () => {
  const zip = createBackupZip([promptWithImages(10)], {
    appVersion: "1.7.0",
    exportedAt: 1,
  });
  const parsed = parseBackupZip(zip);
  assert.equal(parsed.prompts[0].images.length, 10);
  assert.throws(
    () => createBackupZip([promptWithImages(11)], { appVersion: "1.7.0", exportedAt: 1 }),
    /이미지는 최대 10장까지 허용됩니다/,
  );
});
