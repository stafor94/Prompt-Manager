from pathlib import Path

CURRENT_VERSION = "1.6.0"
NEXT_VERSION = "1.7.0"
CURRENT_CACHE = "prompt-manager-shell-v51"
NEXT_CACHE = "prompt-manager-shell-v52"


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_required(path, old, new, *, count=None):
    text = read(path)
    occurrences = text.count(old)
    if occurrences == 0:
        raise RuntimeError(f"{path}: expected text not found: {old!r}")
    if count is not None and occurrences != count:
        raise RuntimeError(f"{path}: expected {count} occurrences, found {occurrences}: {old!r}")
    write(path, text.replace(old, new))


# Image attachment limit in editor/storage normalization and backup/restore validation.
replace_required("app.js", "const MAX_IMAGES = 5;", "const MAX_IMAGES = 10;", count=1)
replace_required(
    "prompt-organization-backup-core.mjs",
    "export const MAX_IMAGES = 5;",
    "export const MAX_IMAGES = 10;",
    count=1,
)

# Editor UI copy and static asset cache-busting.
text = read("index.html")
if CURRENT_VERSION not in text:
    raise RuntimeError("index.html: current version not found")
text = text.replace(CURRENT_VERSION, NEXT_VERSION)
for old, new in [
    ("0 / 5장", "0 / 10장"),
    ("이미지를 최대 5장까지 첨부할 수 있습니다.", "이미지를 최대 10장까지 첨부할 수 있습니다."),
]:
    if old not in text:
        raise RuntimeError(f"index.html: expected text not found: {old}")
    text = text.replace(old, new)
write("index.html", text)

# Service Worker cache and versioned app shell assets.
text = read("sw.js")
if CURRENT_CACHE not in text or CURRENT_VERSION not in text:
    raise RuntimeError("sw.js: current cache/version not found")
text = text.replace(CURRENT_CACHE, NEXT_CACHE).replace(CURRENT_VERSION, NEXT_VERSION)
write("sw.js", text)

# Runtime version constants.
for path in [
    "version-display.js",
    "library-controls.js",
    "archive-six-columns.js",
    "archive-viewer-layout.js",
    "prompt-organization-backup.js",
]:
    replace_required(path, f'APP_VERSION = "{CURRENT_VERSION}"', f'APP_VERSION = "{NEXT_VERSION}"', count=1)

# Release notes runtime version while retaining historical 1.6.0 fallback notes.
release_path = Path("release-notes.js")
release = release_path.read_text(encoding="utf-8")
old_app_version = f'const APP_VERSION = "{CURRENT_VERSION}";'
if release.count(old_app_version) != 1:
    raise RuntimeError("release-notes.js: APP_VERSION marker mismatch")
release = release.replace(old_app_version, f'const APP_VERSION = "{NEXT_VERSION}";', 1)
fallback_marker = "## [1.6.0] - 2026-09-09"
fallback_section = """## [1.7.0] - 2026-09-09

### 변경

- 프롬프트 하나에 첨부할 수 있는 이미지 수를 최대 5장에서 10장으로 늘렸습니다.
- 편집기와 백업·복원에서 동일한 10장 제한을 적용합니다.

"""
if fallback_marker not in release:
    raise RuntimeError("release-notes.js: fallback insertion marker not found")
release = release.replace(fallback_marker, fallback_section + fallback_marker, 1)
release_path.write_text(release, encoding="utf-8")

# Changelog: new MINOR release, preserving prior release history.
changelog_path = Path("CHANGELOG.md")
changelog = changelog_path.read_text(encoding="utf-8")
changelog_marker = "## [1.6.0] - 2026-09-09"
changelog_section = """## [1.7.0] - 2026-09-09

### 변경

- 프롬프트 하나에 첨부할 수 있는 이미지 수를 최대 5장에서 10장으로 늘렸습니다.
- 편집기의 이미지 개수 표시와 초과 선택 안내를 10장 기준으로 갱신했습니다.
- ZIP·JSON 백업 및 복원 검증에서도 프롬프트당 최대 10장의 이미지를 허용합니다.

### 호환성

- 프롬프트 및 백업 데이터 구조는 변경하지 않아 기존 데이터와 기존 백업을 그대로 사용할 수 있습니다.
- 백업 `schemaVersion`은 유지하며 중복 판정 기준도 변경하지 않습니다.

### 테스트

- 10장 첨부·백업 왕복과 11장 초과 거부를 검증하는 회귀 테스트를 추가했습니다.
- 앱 버전과 Service Worker 캐시를 `v1.7.0` / `v52` 기준으로 갱신했습니다.

"""
if changelog_marker not in changelog:
    raise RuntimeError("CHANGELOG.md: insertion marker not found")
changelog = changelog.replace(changelog_marker, changelog_section + changelog_marker, 1)
changelog_path.write_text(changelog, encoding="utf-8")

# Current-version regression tests follow the release version/cache.
for path in Path("test").glob("*.mjs"):
    text = path.read_text(encoding="utf-8")
    text = text.replace(CURRENT_VERSION, NEXT_VERSION)
    text = text.replace(r"1\.6\.0", r"1\.7\.0")
    text = text.replace(CURRENT_CACHE, NEXT_CACHE)
    path.write_text(text, encoding="utf-8")

old_version_test = Path("test/version-1.6.0-assets.test.mjs")
new_version_test = Path("test/version-1.7.0-assets.test.mjs")
if not old_version_test.exists():
    raise RuntimeError("version asset regression test not found")
old_version_test.rename(new_version_test)
text = new_version_test.read_text(encoding="utf-8")
text = text.replace("사용자 정의 LLM", "최대 10장")
new_version_test.write_text(text, encoding="utf-8")

# Explicit regression coverage for the new limit and backup round-trip.
Path("test/image-attachment-limit.test.mjs").write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createBackupZip, parseBackupZip } from "../prompt-organization-backup-core.mjs";

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function promptWithImages(count) {
  return {
    llmType: "CHATGPT",
    title: "이미지 한도 테스트",
    content: "본문",
    createdAt: 1,
    updatedAt: 1,
    isFavorite: false,
    images: Array.from({ length: count }, (_, index) => ({
      id: `image-${index + 1}`,
      name: `image-${index + 1}.png`,
      type: "image/png",
      dataUrl: "data:image/png;base64,AA==",
    })),
  };
}

test("편집기와 백업 검증은 이미지 최대 10장 기준을 사용한다", async () => {
  const [app, index, backup] = await Promise.all([
    read("app.js"),
    read("index.html"),
    read("prompt-organization-backup-core.mjs"),
  ]);
  assert.match(app, /const MAX_IMAGES = 10;/);
  assert.match(backup, /export const MAX_IMAGES = 10;/);
  assert.match(index, /id="editorImageCount">0 \/ 10장/);
  assert.match(index, /이미지를 최대 10장까지 첨부할 수 있습니다\./);
});

test("10장 이미지는 ZIP 백업에서 왕복하고 11장은 거부한다", () => {
  const zip = createBackupZip([promptWithImages(10)], {
    appVersion: "1.7.0",
    exportedAt: 1,
  });
  const parsed = parseBackupZip(zip);
  assert.equal(parsed.prompts[0].images.length, 10);
  assert.throws(
    () => createBackupZip([promptWithImages(11)], { appVersion: "1.7.0", exportedAt: 1 }),
    /이미지는 최대 10장까지 허용됩니다/,
  );
});
''', encoding="utf-8")

print("image attachment limit implementation applied")
