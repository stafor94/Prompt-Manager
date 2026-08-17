from pathlib import Path

VERSION_FROM = "1.5.4"
VERSION_TO = "1.5.5"
CACHE_FROM = "prompt-manager-shell-v48"
CACHE_TO = "prompt-manager-shell-v49"

version_files = [
    "index.html",
    "prompt-organization-backup.js",
    "library-controls.js",
    "archive-six-columns.js",
    "archive-viewer-layout.js",
    "ui-enhancements.js",
    "version-display.js",
    "release-notes.js",
    "sw.js",
]
for name in version_files:
    path = Path(name)
    text = path.read_text()
    if VERSION_FROM not in text:
        raise SystemExit(f"version marker missing: {name}")
    path.write_text(text.replace(VERSION_FROM, VERSION_TO))

sw = Path("sw.js")
text = sw.read_text()
if CACHE_FROM not in text:
    raise SystemExit("service worker cache marker missing")
sw.write_text(text.replace(CACHE_FROM, CACHE_TO))

ui = Path("ui-enhancements.js")
text = ui.read_text()
old_markup = '    <p id="archiveLoadMoreStatus" class="supporting-text" role="status" aria-live="polite" hidden></p>'
new_markup = '''    <div id="archiveLoadMoreStatus" class="archive-load-more-indicator" role="status" aria-live="polite" hidden>
      <span class="visually-hidden">목록 끝에서 위로 스와이프하면 이미지를 더 불러옵니다.</span>
      <span class="archive-swipe-cue" aria-hidden="true">
        <svg viewBox="0 0 24 28" focusable="false">
          <path d="M5 16l7-7 7 7"></path>
          <path d="M5 23l7-7 7 7"></path>
        </svg>
      </span>
    </div>'''
if old_markup not in text:
    raise SystemExit("archive load status markup not found")
text = text.replace(old_markup, new_markup, 1)

old_count = '''  count.textContent = archiveHasMore() || archiveLoading
    ? `로드 ${archiveImages.length} / ${archiveTotals.imageCount}장 · 프롬프트 ${archiveTotals.promptCount}개`
    : `첨부 이미지 ${archiveImages.length}장 · 연결된 프롬프트 ${archiveTotals.promptCount}개`;'''
new_count = '  count.textContent = `첨부 이미지 ${archiveTotals.imageCount}장 · 연결된 프롬프트 ${archiveTotals.promptCount}개`;'
if old_count not in text:
    raise SystemExit("archive count text block not found")
text = text.replace(old_count, new_count, 1)

old_status = '''  if (archiveLoading) {
    loadStatus.hidden = false;
    loadStatus.textContent = "이미지를 불러오는 중입니다.";
  } else if (archiveHasMore()) {
    loadStatus.hidden = false;
    loadStatus.textContent = `${archiveImages.length} / ${archiveTotals.imageCount}장 로드됨 · 목록 끝에서 위로 밀어 더 불러오기`;
  } else {
    loadStatus.hidden = true;
    loadStatus.textContent = "";
  }'''
new_status = '''  const showSwipeCue = !archiveLoading && archiveHasMore() && hasImages;
  loadStatus.hidden = !showSwipeCue;'''
if old_status not in text:
    raise SystemExit("archive load status text block not found")
text = text.replace(old_status, new_status, 1)
ui.write_text(text)

css = Path("archive-grouping.css")
text = css.read_text()
indicator_css = '''

.archive-load-more-indicator {
  display: flex;
  min-height: 58px;
  align-items: center;
  justify-content: center;
  padding: 8px 0 18px;
}

.archive-load-more-indicator[hidden] {
  display: none !important;
}

.archive-swipe-cue {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 999px;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary-container) 72%, transparent);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--primary) 12%, transparent);
  animation: archive-swipe-cue-float 1.55s ease-in-out infinite;
}

.archive-swipe-cue svg {
  width: 24px;
  height: 28px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.archive-swipe-cue path:first-child {
  opacity: .52;
}

@keyframes archive-swipe-cue-float {
  0%, 100% {
    transform: translateY(4px);
    opacity: .58;
  }
  50% {
    transform: translateY(-5px);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .archive-swipe-cue {
    animation: none;
  }
}
'''
if ".archive-load-more-indicator" not in text:
    text += indicator_css
css.write_text(text)

release = Path("release-notes.js")
text = release.read_text()
marker = 'const FALLBACK_CHANGELOG = `\n'
if marker not in text:
    raise SystemExit("release notes fallback marker not found")
entry = '''## [1.5.5] - 2026-08-17

### 수정

- 보관함의 `N / 전체 장수 로드됨` 안내 문구를 제거했습니다.
- 추가 이미지가 남아 있을 때 보관함 하단에 위쪽 스와이프를 의미하는 애니메이션 아이콘만 표시하도록 변경했습니다.
- 이미지 로딩 중에는 안내 아이콘을 숨기고, 다음 묶음 로드가 가능한 상태에서만 다시 표시합니다.
- 동작 줄이기 설정을 사용하는 환경에서는 안내 아이콘 애니메이션을 비활성화합니다.

'''
text = text.replace(marker, marker + entry, 1)
release.write_text(text)

changelog = Path("CHANGELOG.md")
text = changelog.read_text()
marker = "## [미출시]\n\n현재 예정된 변경 사항이 없습니다.\n"
entry = '''

## [1.5.5] - 2026-08-17

### 수정

- 보관함 하단의 `N / 전체 장수 로드됨 · 목록 끝에서 위로 밀어 더 불러오기` 문구를 제거했습니다.
- 추가 이미지가 남아 있으면 하단에 위쪽 스와이프를 의미하는 이중 화살표 애니메이션만 표시하도록 변경했습니다.
- 로딩 중에는 안내 아이콘을 숨기고, 다음 묶음을 불러올 수 있을 때만 노출합니다.
- 보관함 상단 이미지 수는 현재 로드 수 대신 필터 조건에 해당하는 전체 이미지 수를 표시합니다.
- `prefers-reduced-motion` 환경에서는 안내 애니메이션을 비활성화합니다.

### 테스트

- 보관함 진행 문구가 제거되고 스와이프 안내 아이콘과 접근성 문구가 존재하는지 확인하는 회귀 테스트를 추가했습니다.
- 앱 버전과 Service Worker 캐시를 `v1.5.5` 기준으로 갱신했습니다.
'''
if marker not in text:
    raise SystemExit("changelog insertion marker not found")
text = text.replace(marker, marker + entry, 1)
changelog.write_text(text)

for folder in [Path("test"), Path("tests")]:
    if not folder.exists():
        continue
    for path in folder.glob("*.mjs"):
        text = path.read_text()
        text = text.replace(VERSION_FROM, VERSION_TO).replace(CACHE_FROM, CACHE_TO)
        text = text.replace(r"1\.5\.4", r"1\.5\.5")
        path.write_text(text)

Path("test/archive-load-status.test.mjs").write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nasync function read(path) {\n  return readFile(new URL(`../${path}`, import.meta.url), "utf8");\n}\n\ntest("보관함은 진행 문구 대신 추가 로드 스와이프 안내를 표시한다", async () => {\n  const source = await read("ui-enhancements.js");\n  assert.match(source, /archiveLoadMoreStatus/);\n  assert.match(source, /archive-swipe-cue/);\n  assert.match(source, /위로 스와이프하면 이미지를 더 불러옵니다/);\n  assert.doesNotMatch(source, /로드됨 · 목록 끝에서 위로 밀어 더 불러오기/);\n  assert.doesNotMatch(source, /`로드 \\${archiveImages\\.length} \\/ \\${archiveTotals\\.imageCount}장/);\n});\n''')

Path("test/archive-swipe-indicator.test.mjs").write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nasync function read(path) {\n  return readFile(new URL(`../${path}`, import.meta.url), "utf8");\n}\n\ntest("보관함 추가 로드는 문구 대신 위쪽 스와이프 아이콘을 표시한다", async () => {\n  const [ui, css] = await Promise.all([read("ui-enhancements.js"), read("archive-grouping.css")]);\n  assert.doesNotMatch(ui, /로드됨 · 목록 끝에서 위로 밀어 더 불러오기/);\n  assert.doesNotMatch(ui, /이미지를 불러오는 중입니다/);\n  assert.match(ui, /class="archive-load-more-indicator"/);\n  assert.match(ui, /class="archive-swipe-cue"/);\n  assert.match(ui, /위로 스와이프하면 이미지를 더 불러옵니다/);\n  assert.match(ui, /const showSwipeCue = !archiveLoading && archiveHasMore\\(\\) && hasImages/);\n  assert.match(css, /@keyframes archive-swipe-cue-float/);\n  assert.match(css, /prefers-reduced-motion: reduce/);\n});\n\ntest("보관함 상단에는 현재 로드 수가 아니라 전체 이미지 수를 표시한다", async () => {\n  const ui = await read("ui-enhancements.js");\n  assert.match(ui, /첨부 이미지 \\${archiveTotals\\.imageCount}장/);\n  assert.doesNotMatch(ui, /`로드 \\${archiveImages\\.length} \\/ \\${archiveTotals\\.imageCount}장/);\n});\n''')
