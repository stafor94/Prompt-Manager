from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern in {path}: {old!r}")
    p.write_text(text.replace(old, new, 1))


# Single-viewer caption controller: hidden by default, reveal for 3 seconds on tap/move.
replace_once(
    "image-navigation.js",
    'const SWIPE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";\n',
    'const SWIPE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";\nexport const VIEWER_CAPTION_VISIBLE_MS = 3000;\nconst VIEWER_CAPTION_REVEAL_EVENT = "prompt-manager:image-viewer-caption-reveal";\nconst VIEWER_CAPTION_HIDE_EVENT = "prompt-manager:image-viewer-caption-hide";\n',
)
replace_once(
    "image-navigation.js",
    '  let duplicateResetTimer = null;\n\n  viewerImage.style.gridArea = "1 / 1";\n',
    '  let duplicateResetTimer = null;\n  let captionHideTimer = null;\n\n  viewerImage.style.gridArea = "1 / 1";\n',
)
replace_once(
    "image-navigation.js",
    '''  function singleViewerIsActive() {\n    return viewerDialog.dataset.archiveViewerLayout !== "DUAL";\n  }\n\n  function renderSingleViewerCaption() {\n''',
    '''  function singleViewerIsActive() {\n    return viewerDialog.dataset.archiveViewerLayout !== "DUAL";\n  }\n\n  function hideViewerCaption() {\n    clearTimeout(captionHideTimer);\n    captionHideTimer = null;\n    viewerCaption.classList.remove("is-visible");\n    viewerCaption.setAttribute("aria-hidden", "true");\n  }\n\n  function revealViewerCaption() {\n    if (!viewerDialog.open || viewerDialog.dataset.viewerZoomed === "true") {\n      hideViewerCaption();\n      return;\n    }\n    clearTimeout(captionHideTimer);\n    viewerCaption.classList.add("is-visible");\n    viewerCaption.setAttribute("aria-hidden", "false");\n    captionHideTimer = setTimeout(hideViewerCaption, VIEWER_CAPTION_VISIBLE_MS);\n  }\n\n  function renderSingleViewerCaption() {\n''',
)
replace_once(
    "image-navigation.js",
    '''    viewerCaption.textContent = buildViewerCaption(item, index, viewerContext.items.length);\n    if (viewerImage.complete && viewerImage.naturalWidth > 0) {\n      queueMicrotask(renderSingleViewerCaption);\n    }\n''',
    '''    viewerCaption.textContent = buildViewerCaption(item, index, viewerContext.items.length);\n    if (viewerImage.complete && viewerImage.naturalWidth > 0) {\n      queueMicrotask(renderSingleViewerCaption);\n    }\n    revealViewerCaption();\n''',
)
replace_once(
    "image-navigation.js",
    '''  viewerImage.addEventListener("load", renderSingleViewerCaption);\n\n  viewerStage.addEventListener("pointerdown", (event) => {\n''',
    '''  document.addEventListener(VIEWER_CAPTION_REVEAL_EVENT, revealViewerCaption);\n  document.addEventListener(VIEWER_CAPTION_HIDE_EVENT, hideViewerCaption);\n  viewerImage.addEventListener("load", renderSingleViewerCaption);\n\n  viewerStage.addEventListener("pointerdown", (event) => {\n''',
)
replace_once(
    "image-navigation.js",
    '''    if (!gesture.horizontal) {\n      resetSwipeVisuals();\n      return;\n    }\n''',
    '''    if (!gesture.horizontal) {\n      resetSwipeVisuals();\n      revealViewerCaption();\n      return;\n    }\n''',
)
replace_once(
    "image-navigation.js",
    '''    if (direction === 0 || resolveSwipeTarget(direction) === null) {\n      snapBack();\n      return;\n    }\n''',
    '''    if (direction === 0 || resolveSwipeTarget(direction) === null) {\n      revealViewerCaption();\n      snapBack();\n      return;\n    }\n''',
)
replace_once(
    "image-navigation.js",
    '''  viewerDialog.addEventListener("close", () => {\n    viewerContext = null;\n    swipeGesture = null;\n    resetSwipeVisuals();\n  });\n''',
    '''  viewerDialog.addEventListener("close", () => {\n    viewerContext = null;\n    swipeGesture = null;\n    hideViewerCaption();\n    resetSwipeVisuals();\n  });\n''',
)

# Zoom state is authoritative in app.js. Entering zoom cancels caption visibility;
# returning to scale 1 does not reveal it until the next tap/image move.
replace_once(
    "app.js",
    '''function updateViewerTransform() {\n  const { scale, x, y } = state.viewerTransform;\n  elements.imageViewerImage.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;\n}\n''',
    '''function updateViewerTransform() {\n  const { scale, x, y } = state.viewerTransform;\n  elements.imageViewerImage.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;\n  const zoomed = scale > 1.001;\n  elements.imageViewerDialog.dataset.viewerZoomed = String(zoomed);\n  if (zoomed) {\n    elements.imageViewerCaption.classList.remove("is-visible");\n    elements.imageViewerCaption.setAttribute("aria-hidden", "true");\n    document.dispatchEvent(new CustomEvent("prompt-manager:image-viewer-caption-hide"));\n  }\n}\n''',
)
replace_once(
    "app.js",
    '''  const captionTitle = String(title || "첨부 이미지").trim() || "첨부 이미지";\n  elements.imageViewerCaption.textContent = `${index + 1} / ${sourceImages.length} · ${captionTitle}`;\n  resetViewerTransform();\n''',
    '''  const captionTitle = String(title || "첨부 이미지").trim() || "첨부 이미지";\n  elements.imageViewerCaption.textContent = `${index + 1} / ${sourceImages.length} · ${captionTitle}`;\n  elements.imageViewerCaption.classList.remove("is-visible");\n  elements.imageViewerCaption.setAttribute("aria-hidden", "true");\n  resetViewerTransform();\n''',
)

# Dual archive viewer uses the same reveal controller. It has no zoom mode.
replace_once(
    "archive-viewer-layout.js",
    'const HORIZONTAL_DOMINANCE_RATIO = 1.2;\n',
    'const HORIZONTAL_DOMINANCE_RATIO = 1.2;\nconst VIEWER_CAPTION_REVEAL_EVENT = "prompt-manager:image-viewer-caption-reveal";\n',
)
replace_once(
    "archive-viewer-layout.js",
    '''function readArchiveViewerLayout() {\n''',
    '''function revealViewerCaptionTemporarily() {\n  document.dispatchEvent(new CustomEvent(VIEWER_CAPTION_REVEAL_EVENT));\n}\n\nfunction readArchiveViewerLayout() {\n''',
)
replace_once(
    "archive-viewer-layout.js",
    '''function openDualViewer() {\n  const viewerDialog = document.querySelector("#imageViewerDialog");\n  if (!dualContext || !viewerDialog || viewerDialog.open) return false;\n  showDualPair(dualContext.clickedIndex);\n''',
    '''function openDualViewer() {\n  const viewerDialog = document.querySelector("#imageViewerDialog");\n  const viewerCaption = document.querySelector("#imageViewerCaption");\n  if (!dualContext || !viewerDialog || viewerDialog.open) return false;\n  viewerDialog.dataset.viewerZoomed = "false";\n  viewerCaption?.classList.remove("is-visible");\n  viewerCaption?.setAttribute("aria-hidden", "true");\n  showDualPair(dualContext.clickedIndex);\n''',
)
replace_once(
    "archive-viewer-layout.js",
    '''  if (nextStart === dualContext.pairStart) return;\n  showDualPair(nextStart);\n}\n''',
    '''  if (nextStart === dualContext.pairStart) return;\n  showDualPair(nextStart);\n  revealViewerCaptionTemporarily();\n}\n''',
)
replace_once(
    "archive-viewer-layout.js",
    '''    const deltaX = event.clientX - dualGesture.startX;\n    const deltaY = event.clientY - dualGesture.startY;\n    dualGesture = null;\n    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;\n''',
    '''    const deltaX = event.clientX - dualGesture.startX;\n    const deltaY = event.clientY - dualGesture.startY;\n    dualGesture = null;\n    revealViewerCaptionTemporarily();\n    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;\n''',
)

# Fade-out styling and initial accessibility state.
replace_once(
    "fixes.css",
    '''  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.prompt-card[hidden] {\n''',
    '''  text-overflow: ellipsis;\n  white-space: nowrap;\n  opacity: 0;\n  visibility: hidden;\n  pointer-events: none;\n  transition: opacity .24s ease, visibility 0s linear .24s;\n}\n\n.image-viewer-caption.is-visible {\n  opacity: 1;\n  visibility: visible;\n  transition-delay: 0s;\n}\n\n.image-viewer-dialog[data-viewer-zoomed="true"] .image-viewer-caption {\n  opacity: 0;\n  visibility: hidden;\n  transition: none;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .image-viewer-caption {\n    transition: none;\n  }\n}\n\n.prompt-card[hidden] {\n''',
)
replace_once(
    "index.html",
    '<p id="imageViewerCaption" class="image-viewer-caption"></p>',
    '<p id="imageViewerCaption" class="image-viewer-caption" aria-hidden="true"></p>',
)

# Version patch and cache invalidation.
for path in [
    "archive-six-columns.js",
    "archive-viewer-layout.js",
    "library-controls.js",
    "prompt-organization-backup.js",
    "version-display.js",
]:
    p = Path(path)
    text = p.read_text()
    if "1.10.0" not in text:
        raise SystemExit(f"version marker missing in {path}")
    p.write_text(text.replace("1.10.0", "1.10.1"))

p = Path("index.html")
text = p.read_text()
if "1.10.0" not in text:
    raise SystemExit("index version marker missing")
p.write_text(text.replace("1.10.0", "1.10.1"))

p = Path("sw.js")
text = p.read_text()
if "prompt-manager-shell-v55" not in text or "1.10.0" not in text:
    raise SystemExit("sw version marker missing")
p.write_text(text.replace("prompt-manager-shell-v55", "prompt-manager-shell-v56").replace("1.10.0", "1.10.1"))

# Release notes: preserve 1.10.0 history and add a patch entry.
p = Path("release-notes.js")
text = p.read_text()
if 'const APP_VERSION = "1.10.0";' not in text:
    raise SystemExit("release notes app version missing")
text = text.replace('const APP_VERSION = "1.10.0";', 'const APP_VERSION = "1.10.1";', 1)
anchor = 'const FALLBACK_CHANGELOG = `\n## [1.10.0] - 2026-09-11\n'
entry = '''const FALLBACK_CHANGELOG = `\n## [1.10.1] - 2026-09-11\n\n### 변경\n\n- 확대 이미지 뷰어의 하단 이미지 정보는 화면을 한 번 누르거나 이미지가 이동했을 때만 3초 동안 표시되고 페이드아웃됩니다.\n- 이미지를 확대해 보는 동안에는 하단 이미지 정보를 숨깁니다.\n\n## [1.10.0] - 2026-09-11\n'''
if anchor not in text:
    raise SystemExit("release notes fallback anchor missing")
text = text.replace(anchor, entry, 1)
p.write_text(text)

p = Path("CHANGELOG.md")
text = p.read_text()
anchor = '\n\n## [1.10.0] - 2026-09-11\n'
entry = '''\n\n## [1.10.1] - 2026-09-11\n\n### 변경\n\n- 확대 이미지 뷰어의 하단 이미지 정보는 사용자가 화면을 한 번 누르거나 이미지가 이동했을 때만 3초 동안 표시한 뒤 페이드아웃하도록 변경했습니다.\n- 핀치, 더블클릭, 휠 등으로 이미지를 확대해 보는 동안에는 하단 이미지 정보를 즉시 숨기며, 기본 배율로 돌아온 뒤에도 다음 터치 또는 이미지 이동 전까지 다시 표시하지 않습니다.\n- 보관함 2장보기에서도 터치 및 이미지 쌍 이동 시 동일한 3초 표시 규칙을 적용합니다.\n\n### 호환성\n\n- IndexedDB 구조와 ZIP/JSON 백업 schemaVersion은 변경하지 않았습니다.\n\n### 테스트\n\n- 하단 정보 3초 노출, 페이드아웃 스타일, 확대 중 숨김, 단일/2장보기 이동 시 재노출 동작을 회귀 테스트로 확인합니다.\n- 앱 버전과 Service Worker 캐시를 `v1.10.1` / `v56` 기준으로 갱신했습니다.\n\n## [1.10.0] - 2026-09-11\n'''
if anchor not in text:
    raise SystemExit("changelog anchor missing")
p.write_text(text.replace(anchor, entry, 1))

# Keep existing current-version regression expectations aligned.
for p in Path("test").glob("*.mjs"):
    text = p.read_text()
    if "1.10.0" in text:
        p.write_text(text.replace("1.10.0", "1.10.1"))
old_version_test = Path("test/version-1.10.0-assets.test.mjs")
new_version_test = Path("test/version-1.10.1-assets.test.mjs")
if old_version_test.exists():
    old_version_test.rename(new_version_test)

# New caption visibility regression coverage.
Path("test/image-viewer-caption-visibility.test.mjs").write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport { VIEWER_CAPTION_VISIBLE_MS } from "../image-navigation.js";\n\nasync function read(path) {\n  return readFile(new URL(`../${path}`, import.meta.url), "utf8");\n}\n\ntest("확대 이미지 정보는 3초 노출 후 페이드아웃한다", async () => {\n  const [navigation, css, index] = await Promise.all([\n    read("image-navigation.js"),\n    read("fixes.css"),\n    read("index.html"),\n  ]);\n  assert.equal(VIEWER_CAPTION_VISIBLE_MS, 3000);\n  assert.match(navigation, /setTimeout\\(hideViewerCaption, VIEWER_CAPTION_VISIBLE_MS\\)/);\n  assert.match(navigation, /viewerCaption\\.classList\\.add\\("is-visible"\\)/);\n  assert.match(css, /\\.image-viewer-caption\\s*\\{[\\s\\S]*?opacity:\\s*0;[\\s\\S]*?transition:\\s*opacity \\.24s ease/);\n  assert.match(css, /\\.image-viewer-caption\\.is-visible\\s*\\{[\\s\\S]*?opacity:\\s*1;/);\n  assert.match(index, /id="imageViewerCaption"[^>]*aria-hidden="true"/);\n});\n\ntest("단일 뷰어는 터치와 이미지 이동에서만 정보를 다시 노출한다", async () => {\n  const [navigation, app] = await Promise.all([read("image-navigation.js"), read("app.js")]);\n  assert.match(navigation, /if \\(!gesture\\.horizontal\\) \\{[\\s\\S]*?revealViewerCaption\\(\\)/);\n  assert.match(navigation, /function showViewerItem\\(index\\)[\\s\\S]*?revealViewerCaption\\(\\)/);\n  assert.match(app, /openImageViewer\\(images, index, title\\)[\\s\\S]*?classList\\.remove\\("is-visible"\\)/);\n});\n\ntest("확대 중에는 정보를 숨기고 기본 배율 복귀만으로 다시 표시하지 않는다", async () => {\n  const [app, css] = await Promise.all([read("app.js"), read("fixes.css")]);\n  assert.match(app, /const zoomed = scale > 1\\.001;/);\n  assert.match(app, /dataset\\.viewerZoomed = String\\(zoomed\\)/);\n  assert.match(app, /if \\(zoomed\\) \\{[\\s\\S]*?prompt-manager:image-viewer-caption-hide/);\n  assert.match(css, /data-viewer-zoomed="true"[\\s\\S]*?opacity:\\s*0;[\\s\\S]*?transition:\\s*none;/);\n});\n\ntest("보관함 2장보기에서도 터치와 이미지 이동 시 3초 표시를 요청한다", async () => {\n  const layout = await read("archive-viewer-layout.js");\n  assert.match(layout, /function revealViewerCaptionTemporarily\\(\\)/);\n  assert.match(layout, /function moveDualPair\\(direction\\)[\\s\\S]*?showDualPair\\(nextStart\\);[\\s\\S]*?revealViewerCaptionTemporarily\\(\\)/);\n  assert.match(layout, /viewerStage\\.addEventListener\\("pointerup"[\\s\\S]*?revealViewerCaptionTemporarily\\(\\)/);\n});\n''')

print("viewer caption auto-hide update applied")
