from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing pattern in {path}: {old!r}')
    p.write_text(text.replace(old, new, 1))

# Image limit logic.
replace_once('app.js', 'const MAX_IMAGES = 12;', 'const MAX_IMAGES = 20;')
replace_once('prompt-organization-backup-core.mjs', 'export const MAX_IMAGES = 12;', 'export const MAX_IMAGES = 20;')

# Editor UI and current static asset version.
p = Path('index.html')
text = p.read_text()
text = text.replace('1.8.0', '1.9.0')
text = text.replace('0 / 12장', '0 / 20장')
text = text.replace('이미지를 최대 12장까지 첨부할 수 있습니다.', '이미지를 최대 20장까지 첨부할 수 있습니다.')
p.write_text(text)

# Runtime APP_VERSION constants.
for p in Path('.').glob('*.js'):
    text = p.read_text()
    text = text.replace('APP_VERSION = "1.8.0"', 'APP_VERSION = "1.9.0"')
    p.write_text(text)

# Service Worker cache and asset busting.
p = Path('sw.js')
text = p.read_text().replace('prompt-manager-shell-v53', 'prompt-manager-shell-v54').replace('1.8.0', '1.9.0')
p.write_text(text)

# Changelog entry, preserving older release history.
p = Path('CHANGELOG.md')
text = p.read_text()
marker = '현재 예정된 변경 사항이 없습니다.\n\n\n'
entry = '''현재 예정된 변경 사항이 없습니다.\n\n\n## [1.9.0] - 2026-09-10\n\n### 추가\n\n- 프롬프트 하나에 첨부할 수 있는 이미지 수를 최대 12장에서 20장으로 늘렸습니다.\n- 편집기 이미지 개수 표시와 초과 선택 안내를 20장 기준으로 갱신했습니다.\n\n### 호환성\n\n- IndexedDB 구조와 백업 schemaVersion은 변경하지 않아 기존 데이터와 기존 ZIP·JSON 백업을 그대로 사용할 수 있습니다.\n- 백업 및 복원 검증도 프롬프트당 최대 20장 기준을 사용합니다.\n\n### 테스트\n\n- 이미지 20장 ZIP 백업·복원 왕복과 21장 초과 거부 회귀 테스트를 추가했습니다.\n- 앱 버전과 Service Worker 캐시를 `v1.9.0` / `v54` 기준으로 갱신했습니다.\n\n'''
if marker not in text:
    raise SystemExit('CHANGELOG insertion marker missing')
p.write_text(text.replace(marker, entry, 1))

# In-app fallback release notes.
p = Path('release-notes.js')
text = p.read_text()
marker = 'const FALLBACK_CHANGELOG = `\n'
entry = '''const FALLBACK_CHANGELOG = `\n## [1.9.0] - 2026-09-10\n\n### 추가\n\n- 프롬프트 하나에 이미지를 최대 20장까지 첨부할 수 있습니다.\n- 백업 및 복원도 프롬프트당 최대 20장 이미지를 지원합니다.\n\n'''
if marker not in text:
    raise SystemExit('release notes marker missing')
p.write_text(text.replace(marker, entry, 1))

# Update test expectations to current release.
for p in Path('test').glob('*.test.mjs'):
    text = p.read_text().replace('1.8.0', '1.9.0').replace('prompt-manager-shell-v53', 'prompt-manager-shell-v54')
    text = text.replace(r'1\.8\.0', r'1\.9\.0')
    p.write_text(text)

# Image limit regression test: 20 accepted, 21 rejected.
p = Path('test/image-attachment-limit.test.mjs')
text = p.read_text()
text = text.replace('최대 12장 기준', '최대 20장 기준')
text = text.replace('/const MAX_IMAGES = 12;/', '/const MAX_IMAGES = 20;/')
text = text.replace('/export const MAX_IMAGES = 12;/', '/export const MAX_IMAGES = 20;/')
text = text.replace('0 \\/ 12장', '0 \\/ 20장')
text = text.replace('최대 12장까지 첨부', '최대 20장까지 첨부')
text = text.replace('12장 이미지는 ZIP 백업에서 왕복하고 13장은 거부한다', '20장 이미지는 ZIP 백업에서 왕복하고 21장은 거부한다')
text = text.replace('promptWithImages(12)', 'promptWithImages(20)')
text = text.replace('images.length, 12', 'images.length, 20')
text = text.replace('promptWithImages(13)', 'promptWithImages(21)')
text = text.replace('최대 12장까지 허용됩니다', '최대 20장까지 허용됩니다')
p.write_text(text)

# Rename current-version asset test.
old = Path('test/version-1.8.0-assets.test.mjs')
new = Path('test/version-1.9.0-assets.test.mjs')
if old.exists():
    old.rename(new)

print('image attachment limit 20 implementation applied')
