from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing pattern in {path}: {old!r}')
    p.write_text(text.replace(old, new, 1))

# Image limit logic.
replace_once('app.js', 'const MAX_IMAGES = 10;', 'const MAX_IMAGES = 12;')
replace_once('prompt-organization-backup-core.mjs', 'export const MAX_IMAGES = 10;', 'export const MAX_IMAGES = 12;')

# Editor UI and current static asset version.
p = Path('index.html')
text = p.read_text()
text = text.replace('1.7.0', '1.8.0')
text = text.replace('0 / 10장', '0 / 12장')
text = text.replace('이미지를 최대 10장까지 첨부할 수 있습니다.', '이미지를 최대 12장까지 첨부할 수 있습니다.')
p.write_text(text)

# Runtime APP_VERSION constants.
for p in Path('.').glob('*.js'):
    text = p.read_text()
    text = text.replace('APP_VERSION = "1.7.0"', 'APP_VERSION = "1.8.0"')
    p.write_text(text)

# Service Worker cache and asset busting.
p = Path('sw.js')
text = p.read_text().replace('prompt-manager-shell-v52', 'prompt-manager-shell-v53').replace('1.7.0', '1.8.0')
p.write_text(text)

# Changelog entry, preserving older release history.
p = Path('CHANGELOG.md')
text = p.read_text()
marker = '현재 예정된 변경 사항이 없습니다.\n\n\n'
entry = '''현재 예정된 변경 사항이 없습니다.\n\n\n## [1.8.0] - 2026-09-09\n\n### 추가\n\n- 프롬프트 하나에 첨부할 수 있는 이미지 수를 최대 10장에서 12장으로 늘렸습니다.\n- 편집기 이미지 개수 표시와 초과 선택 안내를 12장 기준으로 갱신했습니다.\n\n### 호환성\n\n- IndexedDB 구조와 백업 schemaVersion은 변경하지 않아 기존 데이터와 기존 ZIP·JSON 백업을 그대로 사용할 수 있습니다.\n- 백업 및 복원 검증도 프롬프트당 최대 12장 기준을 사용합니다.\n\n### 테스트\n\n- 이미지 12장 ZIP 백업·복원 왕복과 13장 초과 거부 회귀 테스트를 추가했습니다.\n- 앱 버전과 Service Worker 캐시를 `v1.8.0` / `v53` 기준으로 갱신했습니다.\n\n'''
if marker not in text:
    raise SystemExit('CHANGELOG insertion marker missing')
p.write_text(text.replace(marker, entry, 1))

# In-app fallback release notes.
p = Path('release-notes.js')
text = p.read_text()
marker = 'const FALLBACK_CHANGELOG = `\n'
entry = '''const FALLBACK_CHANGELOG = `\n## [1.8.0] - 2026-09-09\n\n### 추가\n\n- 프롬프트 하나에 이미지를 최대 12장까지 첨부할 수 있습니다.\n- 백업 및 복원도 프롬프트당 최대 12장 이미지를 지원합니다.\n\n'''
if marker not in text:
    raise SystemExit('release notes marker missing')
p.write_text(text.replace(marker, entry, 1))

# Update test expectations to current release.
for p in Path('test').glob('*.test.mjs'):
    text = p.read_text()
    text = text.replace('1.7.0', '1.8.0')
    text = text.replace('1\\.7\\.0', '1\\.8\\.0')
    text = text.replace('prompt-manager-shell-v52', 'prompt-manager-shell-v53')
    p.write_text(text)

# Image limit regression test: 12 accepted, 13 rejected.
p = Path('test/image-attachment-limit.test.mjs')
text = p.read_text()
text = text.replace('최대 10장 기준', '최대 12장 기준')
text = text.replace('/const MAX_IMAGES = 10;/', '/const MAX_IMAGES = 12;/')
text = text.replace('/export const MAX_IMAGES = 10;/', '/export const MAX_IMAGES = 12;/')
text = text.replace('0 \\/ 10장', '0 \\/ 12장')
text = text.replace('최대 10장까지 첨부', '최대 12장까지 첨부')
text = text.replace('10장 이미지는 ZIP 백업에서 왕복하고 11장은 거부한다', '12장 이미지는 ZIP 백업에서 왕복하고 13장은 거부한다')
text = text.replace('promptWithImages(10)', 'promptWithImages(12)')
text = text.replace('images.length, 10', 'images.length, 12')
text = text.replace('promptWithImages(11)', 'promptWithImages(13)')
text = text.replace('최대 10장까지 허용됩니다', '최대 12장까지 허용됩니다')
p.write_text(text)

# Rename current-version asset test.
old = Path('test/version-1.7.0-assets.test.mjs')
new = Path('test/version-1.8.0-assets.test.mjs')
if old.exists():
    old.rename(new)

print('image attachment limit 12 implementation applied')
