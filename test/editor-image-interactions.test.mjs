import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { moveImageById } from "../editor-image-order.mjs";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function ids(items) {
  return items.map((item) => item.id);
}

test("이미지를 대상 앞과 뒤로 이동해 배열 순서를 보존한다", () => {
  const images = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  assert.deepEqual(ids(moveImageById(images, "d", "b", "before")), ["a", "d", "b", "c"]);
  assert.deepEqual(ids(moveImageById(images, "a", "c", "after")), ["b", "c", "a", "d"]);
  assert.deepEqual(ids(images), ["a", "b", "c", "d"]);
});

test("같은 이미지나 없는 대상을 이동하면 원본 배열을 유지한다", () => {
  const images = [{ id: "a" }, { id: "b" }];
  assert.equal(moveImageById(images, "a", "a", "before"), images);
  assert.equal(moveImageById(images, "missing", "b", "before"), images);
  assert.equal(moveImageById(images, "a", "missing", "after"), images);
});

test("신규 편집기는 최근 LLM을 복원하고 선택 변경을 로컬에 기억한다", async () => {
  const app = await read("app.js");
  assert.match(app, /RECENT_EDITOR_LLM_KEY = "prompt-manager-recent-editor-llm"/);
  assert.match(app, /prompt\?\.llmType \?\? getRecentEditorLlm\(\)/);
  assert.match(app, /promptLlm\.addEventListener\("change", \(\) => rememberRecentEditorLlm/);
  assert.match(app, /isKnownLlmType\(llmType, state\.customLlms\) \? llmType : "CHATGPT"/);
});

test("편집기 이미지는 드래그 재정렬과 터치 핸들을 지원한다", async () => {
  const [app, css] = await Promise.all([read("app.js"), read("fixes.css")]);
  assert.match(app, /item\.draggable = true/);
  assert.match(app, /addEventListener\("dragstart"/);
  assert.match(app, /addEventListener\("drop"/);
  assert.match(app, /dataset\.editorDragHandle/);
  assert.match(app, /addEventListener\("pointerdown", beginEditorPointerDrag\)/);
  assert.match(css, /\.editor-image-drag-handle/);
  assert.match(css, /touch-action: none/);
});

test("편집기 이미지 클릭은 공용 상세 이미지 뷰어와 탐색 컨텍스트를 연다", async () => {
  const [app, index, navigation] = await Promise.all([
    read("app.js"),
    read("index.html"),
    read("image-navigation.js"),
  ]);
  assert.match(app, /dataset\.editorImageIndex/);
  assert.match(app, /openImageViewer\(state\.editorImages, Number\(previewButton\.dataset\.editorImageIndex\), title\)/);
  assert.match(app, /function openImageViewer\(images, index, title\)/);
  assert.match(navigation, /function captureEditorContext\(clickedButton\)/);
  assert.match(navigation, /#editorImageList \[data-editor-image-index\]/);
  assert.match(navigation, /editorTitleInput\?\.value\?\.trim\(\)/);
  assert.match(navigation, /queueMicrotask\(renderSingleViewerCaption\)/);
  assert.match(index, /드래그로 순서 변경 · 눌러 상세 보기/);
});

test("새 정렬 코어는 오프라인 앱 셸에 포함된다", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /prompt-manager-shell-v56/);
  assert.match(sw, /\.\/editor-image-order\.mjs/);
});
