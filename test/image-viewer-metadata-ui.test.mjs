import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildViewerCaption } from "../image-navigation.js";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("1장 뷰어는 제목과 해상도·비율을 표시하고 파일명은 제외한다", async () => {
  const source = await read("image-navigation.js");
  assert.match(source, /import \{ formatImageMetadata \} from "\.\/image-metadata\.mjs"/);
  assert.match(source, /formatImageMetadata\(viewerImage\.naturalWidth, viewerImage\.naturalHeight\)/);
  assert.match(source, /viewerImage\.addEventListener\("load", renderSingleViewerCaption\)/);
  assert.match(source, /viewerDialog\.dataset\.archiveViewerLayout !== "DUAL"/);
  assert.match(source, /document\.querySelector\("#detailTitle"\)/);
  assert.match(source, /queueMicrotask\(renderSingleViewerCaption\)/);
  assert.equal(
    buildViewerCaption({ promptTitle: "샘플 제목", imageName: "secret-file.png" }, 0, 3, "1080×1920(9:16)"),
    "1 / 3 · 샘플 제목 · 1080×1920(9:16)",
  );
});

test("기본 이미지 열기 경로도 캡션에 파일명을 넣지 않는다", async () => {
  const [app, archiveUi] = await Promise.all([read("app.js"), read("ui-enhancements.js")]);
  const detailViewer = app.match(/function openImageViewer\([\s\S]*?\n}/)?.[0] ?? "";
  const archiveViewer = archiveUi.match(/function openArchiveImage\([\s\S]*?\n}/)?.[0] ?? "";
  assert.ok(detailViewer, "상세 이미지 열기 함수를 찾을 수 없습니다.");
  assert.ok(archiveViewer, "보관함 이미지 열기 함수를 찾을 수 없습니다.");
  assert.doesNotMatch(detailViewer, /imageViewerCaption\.textContent[^\n]*image\.name/);
  assert.match(detailViewer, /detailTitle\.textContent\.trim\(\)/);
  assert.doesNotMatch(archiveViewer, /imageViewerCaption\.textContent[^\n]*image\.imageName/);
  assert.match(archiveViewer, /image\.promptTitle/);
});

test("2장 뷰어는 좌우 해상도·비율을 하이픈 형식으로 표시한다", async () => {
  const source = await read("archive-viewer-layout.js");
  assert.match(source, /import \{ formatImageMetadata \} from "\.\/image-metadata\.mjs"/);
  assert.match(source, /formatImageMetadata\(viewerImage\.naturalWidth, viewerImage\.naturalHeight\)/);
  assert.match(source, /formatImageMetadata\(secondaryImage\.naturalWidth, secondaryImage\.naturalHeight\)/);
  assert.match(source, /`왼쪽-\$\{leftMetadata\}`/);
  assert.match(source, /`오른쪽-\$\{rightMetadata\}`/);
  assert.match(source, /viewerImage\.addEventListener\("load", renderCurrentDualCaption\)/);
  assert.match(source, /secondaryImage\.addEventListener\("load", renderCurrentDualCaption\)/);
});

test("이미지 메타데이터 모듈은 오프라인 앱 셸에 포함된다", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /\.\/image-metadata\.mjs/);
  assert.match(sw, /prompt-manager-shell-v50/);
});
