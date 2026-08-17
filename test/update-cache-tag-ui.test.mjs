import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const APP_VERSION = "1.5.6";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("화면과 런타임 자산 버전이 v1.5.6으로 일치한다", async () => {
  const [index, versionDisplay, releaseNotes, promptOrganization] = await Promise.all([
    read("index.html"), read("version-display.js"), read("release-notes.js"), read("prompt-organization-backup.js"),
  ]);
  assert.match(index, new RegExp(`>v${APP_VERSION}<`));
  assert.match(index, new RegExp(`update-manager\\.js\\?v=${APP_VERSION}`));
  assert.doesNotMatch(index, /\?v=1\.5\.3|\?v=1\.5\.2|\?v=1\.5\.1|\?v=1\.5\.0|\?v=1\.4\./);
  assert.match(versionDisplay, new RegExp(`APP_VERSION = "${APP_VERSION}"`));
  assert.match(versionDisplay, /archive-viewer-layout\.js\?v=\$\{APP_VERSION\}/);
  assert.match(releaseNotes, new RegExp(`APP_VERSION = "${APP_VERSION}"`));
  assert.match(promptOrganization, new RegExp(`APP_VERSION = "${APP_VERSION}"`));
});

test("본문 입력란은 기본 7행을 표시한다", async () => {
  const index = await read("index.html");
  assert.match(index, /<textarea id="promptContentInput" rows="7" required><\/textarea>/);
  assert.doesNotMatch(index, /<textarea id="promptContentInput" rows="10"/);
});

test("편집 화면을 열 때 제목 입력란에 자동 포커스하지 않는다", async () => {
  const app = await read("app.js");
  const openEditorSource = app.match(/function openEditor\([\s\S]*?\n}\n\nfunction tryCloseEditor/)?.[0] ?? "";
  assert.ok(openEditorSource, "openEditor 함수 구간을 찾을 수 없습니다.");
  assert.doesNotMatch(openEditorSource, /promptTitleInput\.focus\s*\(/);
  assert.match(openEditorSource, /editorDialog\.showModal\(\)/);
});

test("편집 화면에서 즐겨찾기 UI를 숨기고 카드 즐겨찾기 모듈을 로드한다", async () => {
  const [index, favoriteCss, favoriteScript] = await Promise.all([
    read("index.html"), read("favorite-editor-ui.css"), read("card-favorite.js"),
  ]);
  assert.doesNotMatch(index, /editor-favorite-field/);
  assert.match(index, /id="promptFavoriteInput" class="visually-hidden"/);
  assert.match(index, /card-favorite\.js\?v=1\.5\.6/);
  assert.match(index, /favorite-editor-ui\.css\?v=1\.5\.6/);
  assert.match(favoriteCss, /\.favorite-mark\[data-card-favorite="true"\]/);
  assert.match(favoriteCss, /#promptForm \.dialog-content\.form-card\s*\{[^}]*gap:\s*10px;/s);
  assert.match(favoriteScript, /event\.stopImmediatePropagation\(\)/);
  assert.match(favoriteScript, /isFavorite/);
});

test("서비스 워커가 HTTP 캐시를 우회해 신규 앱 셸을 확인한다", async () => {
  const [serviceWorker, updateManager] = await Promise.all([read("sw.js"), read("update-manager.js")]);
  assert.match(serviceWorker, /prompt-manager-shell-v50/);
  assert.match(serviceWorker, /cache: "no-store"/);
  assert.match(serviceWorker, /url\.searchParams\.set\("pm-shell", CACHE_NAME\)/);
  assert.match(serviceWorker, /update-manager\.js\?v=1\.5\.6/);
  assert.match(serviceWorker, /editor-title-extractor\.mjs/);
  assert.match(serviceWorker, /card-favorite\.js\?v=1\.5\.6/);
  assert.match(serviceWorker, /card-favorite-core\.mjs/);
  assert.match(serviceWorker, /prompt-db\.mjs/);
  assert.match(serviceWorker, /archive-pagination-core\.mjs/);
  assert.match(serviceWorker, /favorite-editor-ui\.css\?v=1\.5\.6/);
  assert.match(serviceWorker, /archive-viewer-layout\.js\?v=1\.5\.6/);
  assert.match(serviceWorker, /archive-viewer-layout-core\.mjs/);
  assert.match(serviceWorker, /archive-viewer-layout\.css\?v=1\.5\.6/);
  assert.match(serviceWorker, /image-navigation\.js\?v=1\.5\.6/);
  assert.match(serviceWorker, /image-metadata\.mjs/);
  assert.match(serviceWorker, /image-viewer-fit\.js\?v=1\.5\.6/);
  assert.match(serviceWorker, /prompt-organization-backup\.js\?v=1\.5\.6/);
  assert.match(serviceWorker, /prompt-organization-backup\.css\?v=1\.5\.6/);
  assert.doesNotMatch(serviceWorker, /\?v=1\.5\.3|\?v=1\.5\.2|\?v=1\.5\.1|\?v=1\.5\.0|\?v=1\.4\./);
  assert.match(updateManager, /updateViaCache: "none"/);
  assert.match(updateManager, /await registration\.update\(\)/);
  assert.match(updateManager, /editorDialog\?\.open/);
});

test("태그 패널이 LLM 필터와 분리되는 상단 여백을 갖는다", async () => {
  const css = await read("tag-ui-fixes.css");
  assert.match(css, /#libraryScreen \.organization-filters\s*\{[^}]*margin-top:\s*16px;/s);
});
