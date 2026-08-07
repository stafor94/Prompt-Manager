import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("등록·수정 화면은 즐겨찾기 조작 UI를 노출하지 않는다", async () => {
  const index = await read("index.html");
  assert.doesNotMatch(index, /class="editor-favorite-field/);
  assert.match(index, /<input id="promptFavoriteInput" class="visually-hidden" type="checkbox"/);
});

test("편집 화면 간격을 줄이고 이미지 첨부 영역을 유지한다", async () => {
  const [index, css] = await Promise.all([
    read("index.html"),
    read("favorite-editor-ui.css"),
  ]);

  assert.match(index, /id="addPromptImagesButton"/);
  assert.match(css, /#promptForm \.dialog-content\.form-card\s*\{[^}]*gap:\s*10px;/s);
  assert.match(css, /#promptForm \.prompt-organization-editor\s*\{[^}]*padding:\s*10px 12px;/s);
  assert.match(css, /#promptForm \.image-attachment-field\s*\{[^}]*gap:\s*6px;/s);
});

test("카드 즐겨찾기 아이콘은 항상 표시되고 카드 상세 클릭과 분리된다", async () => {
  const [script, css] = await Promise.all([
    read("card-favorite.js"),
    read("favorite-editor-ui.css"),
  ]);

  assert.match(script, /mark\.textContent = active \? "★" : "☆"/);
  assert.match(script, /mark\.setAttribute\("aria-pressed", String\(active\)\)/);
  assert.match(script, /event\.stopImmediatePropagation\(\)/);
  assert.match(script, /promptList\.addEventListener\("click", handleFavoriteClick, true\)/);
  assert.match(css, /\.prompt-card \.favorite-mark\[data-card-favorite="true"\]/);
  assert.match(css, /position:\s*absolute;/);
  assert.match(css, /right:\s*0;/);
}
);
