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
  assert.match(css, /#archiveScreen \.archive-toolbar\s*\{[^}]*grid-template-columns:[^;}]*3/s);
  assert.match(css, /margin-inline:\s*-2px/);
});
