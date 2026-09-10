import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { VIEWER_CAPTION_VISIBLE_MS } from "../image-navigation.js";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("확대 이미지 정보는 3초 노출 후 페이드아웃한다", async () => {
  const [navigation, css, index] = await Promise.all([
    read("image-navigation.js"),
    read("fixes.css"),
    read("index.html"),
  ]);
  assert.equal(VIEWER_CAPTION_VISIBLE_MS, 3000);
  assert.match(navigation, /setTimeout\(hideViewerCaption, VIEWER_CAPTION_VISIBLE_MS\)/);
  assert.match(navigation, /viewerCaption\.classList\.add\("is-visible"\)/);
  assert.match(css, /\.image-viewer-caption\s*\{[\s\S]*?opacity:\s*0;[\s\S]*?transition:\s*opacity \.24s ease/);
  assert.match(css, /\.image-viewer-caption\.is-visible\s*\{[\s\S]*?opacity:\s*1;/);
  assert.match(index, /id="imageViewerCaption"[^>]*aria-hidden="true"/);
});

test("단일 뷰어는 터치와 이미지 이동에서만 정보를 다시 노출한다", async () => {
  const [navigation, app] = await Promise.all([read("image-navigation.js"), read("app.js")]);
  assert.match(navigation, /if \(!gesture\.horizontal\) \{[\s\S]*?revealViewerCaption\(\)/);
  assert.match(navigation, /function showViewerItem\(index\)[\s\S]*?revealViewerCaption\(\)/);
  assert.match(app, /openImageViewer\(images, index, title\)[\s\S]*?classList\.remove\("is-visible"\)/);
});

test("확대 중에는 정보를 숨기고 기본 배율 복귀만으로 다시 표시하지 않는다", async () => {
  const [app, css] = await Promise.all([read("app.js"), read("fixes.css")]);
  assert.match(app, /const zoomed = scale > 1\.001;/);
  assert.match(app, /dataset\.viewerZoomed = String\(zoomed\)/);
  assert.match(app, /if \(zoomed\) \{[\s\S]*?prompt-manager:image-viewer-caption-hide/);
  assert.match(css, /data-viewer-zoomed="true"[\s\S]*?opacity:\s*0;[\s\S]*?transition:\s*none;/);
});

test("보관함 2장보기에서도 터치와 이미지 이동 시 3초 표시를 요청한다", async () => {
  const layout = await read("archive-viewer-layout.js");
  assert.match(layout, /function revealViewerCaptionTemporarily\(\)/);
  assert.match(layout, /function moveDualPair\(direction\)[\s\S]*?showDualPair\(nextStart\);[\s\S]*?revealViewerCaptionTemporarily\(\)/);
  assert.match(layout, /viewerStage\.addEventListener\("pointerup"[\s\S]*?revealViewerCaptionTemporarily\(\)/);
});
