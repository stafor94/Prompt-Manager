import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("1장 뷰어는 원본 크기로 비율과 해상도 메타 정보를 갱신한다", async () => {
  const source = await read("image-navigation.js");
  assert.match(source, /import \{ formatImageMetadata \} from "\.\/image-metadata\.mjs"/);
  assert.match(source, /formatImageMetadata\(viewerImage\.naturalWidth, viewerImage\.naturalHeight\)/);
  assert.match(source, /viewerImage\.addEventListener\("load", renderSingleViewerCaption\)/);
  assert.match(source, /viewerDialog\.dataset\.archiveViewerLayout !== "DUAL"/);
});

test("2장 뷰어는 왼쪽과 오른쪽 이미지 메타 정보를 각각 표시한다", async () => {
  const source = await read("archive-viewer-layout.js");
  assert.match(source, /import \{ formatImageMetadata \} from "\.\/image-metadata\.mjs"/);
  assert.match(source, /formatImageMetadata\(viewerImage\.naturalWidth, viewerImage\.naturalHeight\)/);
  assert.match(source, /formatImageMetadata\(secondaryImage\.naturalWidth, secondaryImage\.naturalHeight\)/);
  assert.match(source, /`왼쪽 \$\{leftMetadata\}`/);
  assert.match(source, /`오른쪽 \$\{rightMetadata\}`/);
  assert.match(source, /viewerImage\.addEventListener\("load", renderCurrentDualCaption\)/);
  assert.match(source, /secondaryImage\.addEventListener\("load", renderCurrentDualCaption\)/);
});

test("이미지 메타데이터 모듈은 오프라인 앱 셸에 포함된다", async () => {
  const sw = await read("sw.js");
  assert.match(sw, /\.\/image-metadata\.mjs/);
  assert.match(sw, /prompt-manager-shell-v44/);
});
