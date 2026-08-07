import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("보관함 확대 보기 선택은 툴바 가장 오른쪽에 추가된다", async () => {
  const source = await read("archive-viewer-layout.js");
  assert.match(source, />1장보기<\/button>/);
  assert.match(source, />2장보기<\/button>/);
  assert.match(source, /toolbar\.append\(controls\)/);
  assert.match(source, /prompt-manager-archive-viewer-layout/);
});

test("2장보기는 화면을 좌우 두 칸으로 나눈다", async () => {
  const css = await read("archive-viewer-layout.css");
  assert.match(
    css,
    /\.image-viewer-stage\.archive-dual-view-active\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    css,
    /#archiveScreen \.archive-toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*\.9fr\)\s*minmax\(0,\s*1\.4fr\)\s*minmax\(0,\s*\.95fr\)/s,
  );
  assert.match(css, /margin-inline:\s*-2px/);
});

test("2장보기 클릭은 기존 1장 뷰어로 전달하지 않고 두 장 뷰어를 직접 연다", async () => {
  const source = await read("archive-viewer-layout.js");
  assert.match(source, /archiveViewerLayout !== ARCHIVE_VIEWER_LAYOUT_DUAL/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /openDualViewer\(\)/);
  assert.match(source, /viewerDialog\.showModal\(\)/);
  assert.match(source, /promptManagerDualArchiveViewer/);
  assert.doesNotMatch(source, /queueMicrotask\(openCapturedDualViewer\)/);
});

test("2장보기 제스처는 캡처 단계에서 1장보기 스와이프보다 먼저 처리한다", async () => {
  const source = await read("archive-viewer-layout.js");
  assert.match(source, /viewerStage\.addEventListener\("pointerdown",[\s\S]*?\}, true\);/);
  assert.match(source, /viewerStage\.addEventListener\("pointerup",[\s\S]*?moveDualPair\(deltaX < 0 \? 1 : -1\);[\s\S]*?\}, true\);/);
  assert.match(source, /event\.stopImmediatePropagation\(\)/);
});
