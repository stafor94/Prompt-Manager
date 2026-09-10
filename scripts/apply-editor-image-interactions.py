from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern in {path}: {old!r}")
    p.write_text(text.replace(old, new, 1))


# Editor behavior.
replace_once(
    "app.js",
    '} from "./llm-registry.mjs";\n\nconst BACKUP_SCHEMA_VERSION = 3;',
    '} from "./llm-registry.mjs";\nimport { moveImageById } from "./editor-image-order.mjs";\n\nconst BACKUP_SCHEMA_VERSION = 3;',
)
replace_once(
    "app.js",
    'const MAX_IMAGES = 20;\n',
    'const MAX_IMAGES = 20;\nconst RECENT_EDITOR_LLM_KEY = "prompt-manager-recent-editor-llm";\n',
)
replace_once(
    "app.js",
    '  editorImages: [],\n  detailImages: [],',
    '  editorImages: [],\n  editorDraggedImageId: null,\n  editorPointerDrag: null,\n  detailImages: [],',
)
replace_once(
    "app.js",
    '''function cloneImages(images) {\n  return normalizeStoredImages(images).map((image) => ({ ...image }));\n}\n\nfunction getStoredImageCount(prompt) {''',
    '''function cloneImages(images) {\n  return normalizeStoredImages(images).map((image) => ({ ...image }));\n}\n\nfunction getRecentEditorLlm() {\n  try {\n    const llmType = localStorage.getItem(RECENT_EDITOR_LLM_KEY);\n    return isKnownLlmType(llmType, state.customLlms) ? llmType : "CHATGPT";\n  } catch {\n    return "CHATGPT";\n  }\n}\n\nfunction rememberRecentEditorLlm(llmType) {\n  if (!isKnownLlmType(llmType, state.customLlms)) return;\n  try {\n    localStorage.setItem(RECENT_EDITOR_LLM_KEY, llmType);\n  } catch {\n    // 저장소 접근이 제한된 환경에서는 현재 선택만 사용합니다.\n  }\n}\n\nfunction getStoredImageCount(prompt) {''',
)

old_image_item = '''function createEditorImageItem(image) {\n  const item = document.createElement("div");\n  item.className = "editor-image-item";\n  item.dataset.imageId = image.id;\n  const thumbnail = document.createElement("img");\n  thumbnail.src = image.dataUrl;\n  thumbnail.alt = image.name;\n  thumbnail.loading = "lazy";\n  const removeButton = document.createElement("button");\n  removeButton.type = "button";\n  removeButton.className = "remove-image-button";\n  removeButton.dataset.removeImageId = image.id;\n  removeButton.setAttribute("aria-label", `${image.name} 제거`);\n  removeButton.title = "이미지 제거";\n  removeButton.textContent = "×";\n  item.append(thumbnail, removeButton);\n  return item;\n}\n\nfunction renderEditorImages() {\n  elements.editorImageCount.textContent = `${state.editorImages.length} / ${MAX_IMAGES}장`;\n  elements.editorImageEmpty.classList.toggle("hidden", state.editorImages.length > 0);\n  elements.addPromptImagesButton.disabled = state.editorImages.length >= MAX_IMAGES;\n  elements.editorImageList.replaceChildren(...state.editorImages.map(createEditorImageItem));\n}\n'''
new_image_item = '''function createEditorImageItem(image, index) {\n  const item = document.createElement("div");\n  item.className = "editor-image-item";\n  item.dataset.imageId = image.id;\n  item.draggable = true;\n  item.setAttribute("aria-label", `${index + 1}번째 이미지`);\n\n  const previewButton = document.createElement("button");\n  previewButton.type = "button";\n  previewButton.className = "editor-image-preview";\n  previewButton.dataset.editorImageIndex = String(index);\n  previewButton.draggable = true;\n  previewButton.setAttribute("aria-label", `${image.name} 상세 보기`);\n  previewButton.title = "이미지 상세 보기";\n  const thumbnail = document.createElement("img");\n  thumbnail.src = image.dataUrl;\n  thumbnail.alt = image.name;\n  thumbnail.loading = "lazy";\n  thumbnail.draggable = false;\n  previewButton.append(thumbnail);\n\n  const dragHandle = document.createElement("button");\n  dragHandle.type = "button";\n  dragHandle.className = "editor-image-drag-handle";\n  dragHandle.dataset.editorDragHandle = image.id;\n  dragHandle.setAttribute("aria-label", `${image.name} 순서 변경`);\n  dragHandle.title = "드래그하여 순서 변경";\n  dragHandle.textContent = "⠿";\n\n  const removeButton = document.createElement("button");\n  removeButton.type = "button";\n  removeButton.className = "remove-image-button";\n  removeButton.dataset.removeImageId = image.id;\n  removeButton.setAttribute("aria-label", `${image.name} 제거`);\n  removeButton.title = "이미지 제거";\n  removeButton.textContent = "×";\n  item.append(previewButton, dragHandle, removeButton);\n  return item;\n}\n\nfunction renderEditorImages() {\n  elements.editorImageCount.textContent = `${state.editorImages.length} / ${MAX_IMAGES}장`;\n  elements.editorImageEmpty.classList.toggle("hidden", state.editorImages.length > 0);\n  elements.addPromptImagesButton.disabled = state.editorImages.length >= MAX_IMAGES;\n  elements.editorImageList.replaceChildren(\n    ...state.editorImages.map((image, index) => createEditorImageItem(image, index)),\n  );\n}\n\nfunction clearEditorDropIndicators() {\n  elements.editorImageList.querySelectorAll(".drop-before, .drop-after").forEach((item) => {\n    item.classList.remove("drop-before", "drop-after");\n  });\n}\n\nfunction clearEditorDragState() {\n  clearEditorDropIndicators();\n  elements.editorImageList.querySelectorAll(".dragging").forEach((item) => item.classList.remove("dragging"));\n  state.editorDraggedImageId = null;\n  state.editorPointerDrag = null;\n}\n\nfunction getEditorDropPlacement(item, clientX) {\n  const rect = item.getBoundingClientRect();\n  return clientX >= rect.left + (rect.width / 2) ? "after" : "before";\n}\n\nfunction markEditorDropTarget(item, placement) {\n  clearEditorDropIndicators();\n  item.classList.add(placement === "after" ? "drop-after" : "drop-before");\n}\n\nfunction reorderEditorImage(sourceId, targetId, placement = "before") {\n  const reordered = moveImageById(state.editorImages, sourceId, targetId, placement);\n  if (reordered === state.editorImages) return false;\n  state.editorImages = reordered;\n  renderEditorImages();\n  return true;\n}\n\nfunction beginEditorPointerDrag(event) {\n  if (event.pointerType === "mouse" || !event.isPrimary || event.button !== 0) return;\n  const handle = event.target.closest("[data-editor-drag-handle]");\n  const item = handle?.closest(".editor-image-item");\n  if (!handle || !item) return;\n  event.preventDefault();\n  handle.setPointerCapture?.(event.pointerId);\n  state.editorPointerDrag = {\n    pointerId: event.pointerId,\n    sourceId: item.dataset.imageId,\n    targetId: null,\n    placement: "before",\n  };\n  item.classList.add("dragging");\n}\n\nfunction updateEditorPointerDrag(event) {\n  const drag = state.editorPointerDrag;\n  if (!drag || drag.pointerId !== event.pointerId) return;\n  event.preventDefault();\n  const hit = document.elementFromPoint(event.clientX, event.clientY);\n  const target = hit?.closest?.(".editor-image-item");\n  if (!target || !elements.editorImageList.contains(target) || target.dataset.imageId === drag.sourceId) {\n    drag.targetId = null;\n    clearEditorDropIndicators();\n    return;\n  }\n  drag.targetId = target.dataset.imageId;\n  drag.placement = getEditorDropPlacement(target, event.clientX);\n  markEditorDropTarget(target, drag.placement);\n}\n\nfunction finishEditorPointerDrag(event, commit = true) {\n  const drag = state.editorPointerDrag;\n  if (!drag || drag.pointerId !== event.pointerId) return;\n  event.preventDefault();\n  if (commit && drag.targetId) reorderEditorImage(drag.sourceId, drag.targetId, drag.placement);\n  clearEditorDragState();\n}\n'''
replace_once("app.js", old_image_item, new_image_item)
replace_once(
    "app.js",
    '  elements.promptLlm.value = prompt?.llmType ?? "CHATGPT";',
    '  elements.promptLlm.value = prompt?.llmType ?? getRecentEditorLlm();',
)
replace_once(
    "app.js",
    '  await putPrompt(prompt);\n  state.editorSnapshot = currentEditorValue();',
    '  await putPrompt(prompt);\n  rememberRecentEditorLlm(llmType);\n  state.editorSnapshot = currentEditorValue();',
)
replace_once(
    "app.js",
    '''function openImageViewer(index) {\n  const image = state.detailImages[index];\n  if (!image) return;\n  elements.imageViewerImage.src = image.dataUrl;\n  elements.imageViewerImage.alt = image.name;\n  elements.imageViewerCaption.textContent = `${index + 1} / ${state.detailImages.length} · ${elements.detailTitle.textContent.trim()}`;\n  resetViewerTransform();\n  elements.imageViewerDialog.showModal();\n  history.pushState({ ...(history.state ?? {}), promptManagerImageViewer: true }, "", location.href);\n  state.imageViewerHistoryActive = true;\n}\n''',
    '''function openImageViewer(images, index, title) {\n  const sourceImages = Array.isArray(images) ? images : [];\n  const image = sourceImages[index];\n  if (!image) return;\n  elements.imageViewerImage.src = image.dataUrl;\n  elements.imageViewerImage.alt = image.name;\n  const captionTitle = String(title || "첨부 이미지").trim() || "첨부 이미지";\n  elements.imageViewerCaption.textContent = `${index + 1} / ${sourceImages.length} · ${captionTitle}`;\n  resetViewerTransform();\n  elements.imageViewerDialog.showModal();\n  history.pushState({ ...(history.state ?? {}), promptManagerImageViewer: true }, "", location.href);\n  state.imageViewerHistoryActive = true;\n}\n''',
)

old_events = '''  elements.promptTitleInput.addEventListener("input", updateTitleCount);\n  elements.promptForm.addEventListener("submit", (event) => submitPrompt(event).catch(handleError));'''
new_events = '''  elements.promptTitleInput.addEventListener("input", updateTitleCount);\n  elements.promptLlm.addEventListener("change", () => rememberRecentEditorLlm(elements.promptLlm.value));\n  elements.promptForm.addEventListener("submit", (event) => submitPrompt(event).catch(handleError));'''
replace_once("app.js", old_events, new_events)

old_editor_click = '''  elements.editorImageList.addEventListener("click", (event) => {\n    const button = event.target.closest("[data-remove-image-id]");\n    if (!button) return;\n    state.editorImages = state.editorImages.filter((image) => image.id !== button.dataset.removeImageId);\n    renderEditorImages();\n    showSnackbar("이미지를 제거했습니다.");\n  });\n'''
new_editor_click = '''  elements.editorImageList.addEventListener("click", (event) => {\n    const removeButton = event.target.closest("[data-remove-image-id]");\n    if (removeButton) {\n      state.editorImages = state.editorImages.filter((image) => image.id !== removeButton.dataset.removeImageId);\n      renderEditorImages();\n      showSnackbar("이미지를 제거했습니다.");\n      return;\n    }\n    const previewButton = event.target.closest("[data-editor-image-index]");\n    if (previewButton) {\n      const title = elements.promptTitleInput.value.trim() || elements.editorTitle.textContent.trim();\n      openImageViewer(state.editorImages, Number(previewButton.dataset.editorImageIndex), title);\n    }\n  });\n  elements.editorImageList.addEventListener("dragstart", (event) => {\n    const item = event.target.closest(".editor-image-item");\n    if (!item || event.target.closest("[data-remove-image-id]")) {\n      event.preventDefault();\n      return;\n    }\n    state.editorDraggedImageId = item.dataset.imageId;\n    item.classList.add("dragging");\n    if (event.dataTransfer) {\n      event.dataTransfer.effectAllowed = "move";\n      event.dataTransfer.setData("text/plain", state.editorDraggedImageId);\n    }\n  });\n  elements.editorImageList.addEventListener("dragover", (event) => {\n    if (!state.editorDraggedImageId) return;\n    const target = event.target.closest(".editor-image-item");\n    if (!target || target.dataset.imageId === state.editorDraggedImageId) return;\n    event.preventDefault();\n    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";\n    markEditorDropTarget(target, getEditorDropPlacement(target, event.clientX));\n  });\n  elements.editorImageList.addEventListener("drop", (event) => {\n    if (!state.editorDraggedImageId) return;\n    const target = event.target.closest(".editor-image-item");\n    event.preventDefault();\n    if (target && target.dataset.imageId !== state.editorDraggedImageId) {\n      reorderEditorImage(\n        state.editorDraggedImageId,\n        target.dataset.imageId,\n        getEditorDropPlacement(target, event.clientX),\n      );\n    }\n    clearEditorDragState();\n  });\n  elements.editorImageList.addEventListener("dragend", clearEditorDragState);\n  elements.editorImageList.addEventListener("pointerdown", beginEditorPointerDrag);\n  elements.editorImageList.addEventListener("pointermove", updateEditorPointerDrag);\n  elements.editorImageList.addEventListener("pointerup", (event) => finishEditorPointerDrag(event, true));\n  elements.editorImageList.addEventListener("pointercancel", (event) => finishEditorPointerDrag(event, false));\n'''
replace_once("app.js", old_editor_click, new_editor_click)
replace_once(
    "app.js",
    '    if (button) openImageViewer(Number(button.dataset.detailImageIndex));',
    '    if (button) openImageViewer(state.detailImages, Number(button.dataset.detailImageIndex), elements.detailTitle.textContent.trim());',
)

# Pure image order helper used by the editor and directly unit tested.
Path("editor-image-order.mjs").write_text('''export function moveImageById(images, sourceId, targetId, placement = "before") {\n  if (!Array.isArray(images) || sourceId === targetId) return images;\n  const sourceIndex = images.findIndex((image) => image?.id === sourceId);\n  const targetIndex = images.findIndex((image) => image?.id === targetId);\n  if (sourceIndex < 0 || targetIndex < 0) return images;\n\n  const reordered = images.slice();\n  const [moved] = reordered.splice(sourceIndex, 1);\n  const remainingTargetIndex = reordered.findIndex((image) => image?.id === targetId);\n  const insertIndex = remainingTargetIndex + (placement === "after" ? 1 : 0);\n  reordered.splice(insertIndex, 0, moved);\n  return reordered;\n}\n''')

# Editor styling and usage hint.
p = Path("fixes.css")
text = p.read_text()
text += '''\n\n/* v1.10.0 editor image ordering and preview */\n.image-attachment-hint {\n  font-size: .75rem;\n  font-weight: 500;\n}\n\n.editor-image-item {\n  cursor: grab;\n  transition: opacity .12s ease, transform .12s ease, box-shadow .12s ease;\n}\n\n.editor-image-item.dragging {\n  opacity: .55;\n  transform: scale(.97);\n}\n\n.editor-image-item.drop-before {\n  box-shadow: inset 4px 0 0 var(--primary);\n}\n\n.editor-image-item.drop-after {\n  box-shadow: inset -4px 0 0 var(--primary);\n}\n\n.editor-image-preview {\n  display: block;\n  width: 100%;\n  height: 100%;\n  min-height: 0;\n  padding: 0;\n  overflow: hidden;\n  border: 0;\n  border-radius: 0;\n  background: transparent;\n  cursor: zoom-in;\n}\n\n.editor-image-drag-handle {\n  position: absolute;\n  left: 4px;\n  bottom: 4px;\n  z-index: 3;\n  display: inline-grid;\n  place-items: center;\n  width: 34px;\n  min-width: 34px;\n  height: 34px;\n  min-height: 34px;\n  padding: 0;\n  border: 0;\n  border-radius: 50%;\n  background: rgba(0, 0, 0, .68);\n  color: #fff;\n  cursor: grab;\n  font-size: 1.25rem;\n  line-height: 1;\n  touch-action: none;\n  user-select: none;\n  -webkit-user-select: none;\n}\n\n.editor-image-drag-handle:active {\n  cursor: grabbing;\n}\n\n.remove-image-button {\n  z-index: 3;\n}\n'''
p.write_text(text)

replace_once(
    "index.html",
    '<small id="editorImageCount">0 / 20장</small>',
    '<small id="editorImageCount">0 / 20장</small>\n              <small class="image-attachment-hint">드래그로 순서 변경 · 눌러 상세 보기</small>',
)

# Version synchronization for this backward-compatible feature release.
p = Path("index.html")
p.write_text(p.read_text().replace("1.9.0", "1.10.0"))
for p in Path(".").glob("*.js"):
    text = p.read_text().replace('APP_VERSION = "1.9.0"', 'APP_VERSION = "1.10.0"')
    p.write_text(text)
p = Path("sw.js")
text = p.read_text().replace("prompt-manager-shell-v54", "prompt-manager-shell-v55").replace("1.9.0", "1.10.0")
text = text.replace('  "./app.js?v=1.10.0",\n', '  "./app.js?v=1.10.0",\n  "./editor-image-order.mjs",\n', 1)
p.write_text(text)

# Changelog and in-app release notes preserve all historical entries.
p = Path("CHANGELOG.md")
text = p.read_text()
marker = "현재 예정된 변경 사항이 없습니다.\n\n\n"
entry = '''현재 예정된 변경 사항이 없습니다.\n\n\n## [1.10.0] - 2026-09-11\n\n### 추가\n\n- 새 프롬프트 팝업은 사용자가 가장 최근에 선택한 LLM을 다음 신규 프롬프트의 기본값으로 복원합니다.\n- 신규·수정 편집기에서 첨부 이미지의 순서를 드래그앤드롭으로 변경할 수 있습니다. 마우스 드래그와 터치·펜용 드래그 핸들을 모두 지원합니다.\n- 신규·수정 편집기에서 이미지 썸네일을 누르면 기존 확대 상세 뷰어로 이미지를 확인할 수 있습니다.\n\n### 호환성\n\n- IndexedDB 구조와 백업 schemaVersion은 변경하지 않았습니다. 이미지 순서는 기존 images 배열 순서를 그대로 사용합니다.\n- 최근 LLM 선택값은 로컬 브라우저 설정에만 저장되며, 저장된 사용자 정의 LLM이 더 이상 유효하지 않으면 ChatGPT로 안전하게 대체합니다.\n\n### 테스트\n\n- 이미지 순서 이동 코어의 앞/뒤 이동 및 잘못된 대상 처리 테스트를 추가했습니다.\n- 최근 LLM 기본값, 편집기 드래그앤드롭, 편집 이미지 상세 보기 연결을 회귀 테스트로 확인합니다.\n- 앱 버전과 Service Worker 캐시를 `v1.10.0` / `v55` 기준으로 갱신했습니다.\n\n'''
if marker not in text:
    raise SystemExit("CHANGELOG insertion marker missing")
p.write_text(text.replace(marker, entry, 1))

p = Path("release-notes.js")
text = p.read_text()
marker = 'const FALLBACK_CHANGELOG = `\n'
entry = '''const FALLBACK_CHANGELOG = `\n## [1.10.0] - 2026-09-11\n\n### 추가\n\n- 새 프롬프트에서 가장 최근에 선택한 LLM을 기본값으로 사용합니다.\n- 신규·수정 화면에서 이미지를 드래그해 순서를 바꾸고, 이미지를 눌러 확대 상세 보기를 열 수 있습니다.\n\n'''
if marker not in text:
    raise SystemExit("release notes marker missing")
p.write_text(text.replace(marker, entry, 1))

# Update current-version regression expectations.
for p in Path("test").glob("*.test.mjs"):
    text = p.read_text().replace("1.9.0", "1.10.0").replace(r"1\.9\.0", r"1\.10\.0")
    text = text.replace("prompt-manager-shell-v54", "prompt-manager-shell-v55")
    text = text.replace("2026-09-10", "2026-09-11")
    p.write_text(text)
old = Path("test/version-1.9.0-assets.test.mjs")
new = Path("test/version-1.10.0-assets.test.mjs")
if old.exists():
    old.rename(new)

# Focused functional and wiring tests.
Path("test/editor-image-interactions.test.mjs").write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nimport { moveImageById } from "../editor-image-order.mjs";\n\nasync function read(path) {\n  return readFile(new URL(`../${path}`, import.meta.url), "utf8");\n}\n\nfunction ids(items) {\n  return items.map((item) => item.id);\n}\n\ntest("이미지를 대상 앞과 뒤로 이동해 배열 순서를 보존한다", () => {\n  const images = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];\n  assert.deepEqual(ids(moveImageById(images, "d", "b", "before")), ["a", "d", "b", "c"]);\n  assert.deepEqual(ids(moveImageById(images, "a", "c", "after")), ["b", "c", "a", "d"]);\n  assert.deepEqual(ids(images), ["a", "b", "c", "d"]);\n});\n\ntest("같은 이미지나 없는 대상을 이동하면 원본 배열을 유지한다", () => {\n  const images = [{ id: "a" }, { id: "b" }];\n  assert.equal(moveImageById(images, "a", "a", "before"), images);\n  assert.equal(moveImageById(images, "missing", "b", "before"), images);\n  assert.equal(moveImageById(images, "a", "missing", "after"), images);\n});\n\ntest("신규 편집기는 최근 LLM을 복원하고 선택 변경을 로컬에 기억한다", async () => {\n  const app = await read("app.js");\n  assert.match(app, /RECENT_EDITOR_LLM_KEY = "prompt-manager-recent-editor-llm"/);\n  assert.match(app, /prompt\?\.llmType \?\? getRecentEditorLlm\(\)/);\n  assert.match(app, /promptLlm\.addEventListener\("change", \(\) => rememberRecentEditorLlm/);\n  assert.match(app, /isKnownLlmType\(llmType, state\.customLlms\) \? llmType : "CHATGPT"/);\n});\n\ntest("편집기 이미지는 드래그 재정렬과 터치 핸들을 지원한다", async () => {\n  const [app, css] = await Promise.all([read("app.js"), read("fixes.css")]);\n  assert.match(app, /item\.draggable = true/);\n  assert.match(app, /addEventListener\("dragstart"/);\n  assert.match(app, /addEventListener\("drop"/);\n  assert.match(app, /data\.editorDragHandle/);\n  assert.match(app, /addEventListener\("pointerdown", beginEditorPointerDrag\)/);\n  assert.match(css, /\.editor-image-drag-handle/);\n  assert.match(css, /touch-action: none/);\n});\n\ntest("편집기 이미지 클릭은 공용 상세 이미지 뷰어를 연다", async () => {\n  const [app, index] = await Promise.all([read("app.js"), read("index.html")]);\n  assert.match(app, /data\.editorImageIndex/);\n  assert.match(app, /openImageViewer\(state\.editorImages, Number\(previewButton\.dataset\.editorImageIndex\), title\)/);\n  assert.match(app, /function openImageViewer\(images, index, title\)/);\n  assert.match(index, /드래그로 순서 변경 · 눌러 상세 보기/);\n});\n\ntest("새 정렬 코어는 오프라인 앱 셸에 포함된다", async () => {\n  const sw = await read("sw.js");\n  assert.match(sw, /prompt-manager-shell-v55/);\n  assert.match(sw, /\.\/editor-image-order\.mjs/);\n});\n''')

# Make the current-version asset test describe the new release directly.
p = Path("test/version-1.10.0-assets.test.mjs")
text = p.read_text()
text = text.replace('assert.match(changelog, /최대 10장/);', 'assert.match(changelog, /드래그앤드롭/);')
p.write_text(text)

print("editor recent LLM, image reorder, and preview implementation applied")
