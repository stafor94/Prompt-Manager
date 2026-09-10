from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing pattern in {path}: {old!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "image-navigation.js",
    '  const editorDialog = document.querySelector("#editorDialog");\n  const editorImageList = document.querySelector("#editorImageList");\n',
    '  const editorDialog = document.querySelector("#editorDialog");\n  const editorImageList = document.querySelector("#editorImageList");\n  const editorTitleInput = document.querySelector("#promptTitleInput");\n  const editorTitle = document.querySelector("#editorTitle");\n',
)

replace_once(
    "image-navigation.js",
    '''  function captureArchiveContext(clickedButton) {\n''',
    '''  function captureEditorContext(clickedButton) {\n    if (!editorImageList) return;\n    const buttons = [...editorImageList.querySelectorAll("[data-editor-image-index]")]\n      .filter(isVisible);\n    const promptTitle = editorTitleInput?.value?.trim()\n      || editorTitle?.textContent?.trim()\n      || "첨부 이미지";\n    const items = buttons\n      .map((button) => imageItemFromButton(button, promptTitle))\n      .filter(Boolean);\n    const index = buttons.indexOf(clickedButton);\n    if (index < 0 || items.length === 0) return;\n    viewerContext = { items, index };\n  }\n\n  function captureArchiveContext(clickedButton) {\n''',
)

replace_once(
    "image-navigation.js",
    '''  document.addEventListener("click", (event) => {\n    const detailButton = event.target.closest?.("#detailImageStrip [data-detail-image-index]");\n''',
    '''  document.addEventListener("click", (event) => {\n    const editorButton = event.target.closest?.("#editorImageList [data-editor-image-index]");\n    if (editorButton) {\n      captureEditorContext(editorButton);\n      queueMicrotask(renderSingleViewerCaption);\n      return;\n    }\n\n    const detailButton = event.target.closest?.("#detailImageStrip [data-detail-image-index]");\n''',
)

# The image-less duplicate path must honor the current 20-image editor limit too.
replace_once(
    "image-navigation.js",
    '    while (removeButton && removedCount < 10) {',
    '    while (removeButton && removedCount < 20) {',
)

# Strengthen interaction regression coverage for the shared viewer context.
p = Path("test/editor-image-interactions.test.mjs")
text = p.read_text()
old = '''test("편집기 이미지 클릭은 공용 상세 이미지 뷰어를 연다", async () => {\n  const [app, index] = await Promise.all([read("app.js"), read("index.html")]);\n  assert.match(app, /dataset\\.editorImageIndex/);\n  assert.match(app, /openImageViewer\\(state\\.editorImages, Number\\(previewButton\\.dataset\\.editorImageIndex\\), title\\)/);\n  assert.match(app, /function openImageViewer\\(images, index, title\\)/);\n  assert.match(index, /드래그로 순서 변경 · 눌러 상세 보기/);\n});\n'''
new = '''test("편집기 이미지 클릭은 공용 상세 이미지 뷰어와 탐색 컨텍스트를 연다", async () => {\n  const [app, index, navigation] = await Promise.all([\n    read("app.js"),\n    read("index.html"),\n    read("image-navigation.js"),\n  ]);\n  assert.match(app, /dataset\\.editorImageIndex/);\n  assert.match(app, /openImageViewer\\(state\\.editorImages, Number\\(previewButton\\.dataset\\.editorImageIndex\\), title\\)/);\n  assert.match(app, /function openImageViewer\\(images, index, title\\)/);\n  assert.match(navigation, /function captureEditorContext\\(clickedButton\\)/);\n  assert.match(navigation, /#editorImageList \\[data-editor-image-index\\]/);\n  assert.match(navigation, /editorTitleInput\\?\\.value\\?\\.trim\\(\\)/);\n  assert.match(navigation, /queueMicrotask\\(renderSingleViewerCaption\\)/);\n  assert.match(index, /드래그로 순서 변경 · 눌러 상세 보기/);\n});\n'''
if old not in text:
    raise SystemExit("editor viewer test pattern missing")
p.write_text(text.replace(old, new, 1))

# Keep the image limit regression aligned with the duplicate-without-images helper.
p = Path("test/image-attachment-limit.test.mjs")
text = p.read_text()
anchor = '  assert.match(backup, /export const MAX_IMAGES = 20;/);\n'
if anchor not in text:
    raise SystemExit("image limit test anchor missing")
text = text.replace(
    anchor,
    anchor + '  const navigation = await read("image-navigation.js");\n  assert.match(navigation, /removedCount < 20/);\n',
    1,
)
p.write_text(text)

print("editor viewer context refinement applied")
