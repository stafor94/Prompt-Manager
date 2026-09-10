from pathlib import Path

p = Path("test/editor-image-interactions.test.mjs")
text = p.read_text()
text = text.replace(r"/data\.editorDragHandle/", r"/dataset\.editorDragHandle/")
text = text.replace(r"/data\.editorImageIndex/", r"/dataset\.editorImageIndex/")
p.write_text(text)

p = Path("test/image-viewer-metadata-ui.test.mjs")
text = p.read_text()
old = r'assert.match(detailViewer, /detailTitle\.textContent\.trim\(\)/);'
new = r'assert.match(detailViewer, /String\(title \|\| "첨부 이미지"\)/);'
if old not in text:
    raise SystemExit("image viewer assertion pattern missing")
p.write_text(text.replace(old, new, 1))

print("editor interaction test expectations aligned")
