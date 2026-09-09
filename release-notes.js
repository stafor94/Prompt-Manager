import { parseReleaseNotes } from "./release-notes-core.mjs";

const APP_VERSION = "1.6.0";
const CHANGELOG_URL = `./CHANGELOG.md?v=${APP_VERSION}`;
const FALLBACK_CHANGELOG = `
## [1.6.0] - 2026-09-09

### 추가

- 설정에서 이름 10자 이하의 사용자 정의 LLM을 추가할 수 있습니다.
- 추가한 LLM은 프롬프트 편집, 필터, 보관함, 백업 및 복원에서 기본 LLM과 동일하게 동작합니다.
- 사용자 정의 LLM은 IndexedDB에 저장되며 기존 백업 형식은 계속 복원할 수 있습니다.

## [1.5.6] - 2026-08-17

### 수정

- 보관함 추가 로드는 선택된 2·3·4·6열에 맞춰 마지막 표시 행이 채워지도록 정렬합니다.
- 열 수 변경 후 마지막 행에 빈 칸이 생기면 남은 이미지가 있는 경우 필요한 수만 이어서 표시합니다.
- 실제 데이터의 마지막 행은 이미지 누락 없이 모두 표시합니다.
- 하단 위로 스와이프 안내 아이콘의 아래 여백을 더 줄였습니다.

## [1.5.5] - 2026-08-17

### 수정

- 보관함의 `N / 전체 장수 로드됨` 안내 문구를 제거했습니다.
- 추가 이미지가 남아 있을 때 보관함 하단에 위쪽 스와이프를 의미하는 애니메이션 아이콘만 표시하도록 변경했습니다.
- 이미지 로딩 중에는 안내 아이콘을 숨기고, 다음 묶음 로드가 가능한 상태에서만 다시 표시합니다.
- 동작 줄이기 설정을 사용하는 환경에서는 안내 아이콘 애니메이션을 비활성화합니다.

## [1.5.5] - 2026-08-17

### 성능

- 보관함은 경량 프롬프트 요약만 먼저 읽고 첫 이미지 묶음만 로드하도록 변경했습니다.
- 목록 끝에서 위로 밀거나 마우스 휠을 더 내리면 다음 이미지 묶음을 추가로 읽습니다.
- 보관함 LLM 필터 변경 시 선택된 LLM의 이미지 데이터만 다시 점진적으로 로드합니다.
`;

function ensureStylesheet() {
  if (document.querySelector('link[data-release-notes-style="true"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `./release-notes.css?v=${APP_VERSION}`;
  link.dataset.releaseNotesStyle = "true";
  document.head.append(link);
}

function createDialog() {
  const dialog = document.createElement("dialog");
  dialog.id = "releaseNotesDialog";
  dialog.className = "dialog release-notes-dialog";
  dialog.setAttribute("aria-labelledby", "releaseNotesHeading");
  const article = document.createElement("article");
  const header = document.createElement("div");
  header.className = "dialog-header";
  const headingBox = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Release Notes";
  const heading = document.createElement("h2");
  heading.id = "releaseNotesHeading";
  heading.textContent = "릴리즈 노트";
  headingBox.append(eyebrow, heading);
  const headerCloseButton = document.createElement("button");
  headerCloseButton.type = "button";
  headerCloseButton.className = "icon-button";
  headerCloseButton.setAttribute("aria-label", "릴리즈 노트 닫기");
  headerCloseButton.textContent = "×";
  header.append(headingBox, headerCloseButton);

  const content = document.createElement("div");
  content.className = "dialog-content release-notes-content";
  const status = document.createElement("p");
  status.className = "supporting-text release-notes-status";
  status.textContent = "릴리즈 노트를 불러오는 중입니다.";
  const list = document.createElement("div");
  list.className = "release-notes-list";
  content.append(status, list);

  const actions = document.createElement("div");
  actions.className = "dialog-actions";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "filled-button";
  closeButton.textContent = "닫기";
  actions.append(closeButton);
  article.append(header, content, actions);
  dialog.append(article);

  const close = () => dialog.close();
  headerCloseButton.addEventListener("click", close);
  closeButton.addEventListener("click", close);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  return { dialog, status, list };
}

function createReleaseItem(release, index) {
  const details = document.createElement("details");
  details.className = "release-note-item";
  details.open = index === 0;
  const summary = document.createElement("summary");
  const version = document.createElement("strong");
  version.textContent = release.version === "미출시" ? release.version : `v${release.version}`;
  const date = document.createElement("span");
  date.textContent = release.date;
  summary.append(version, date);
  const body = document.createElement("div");
  body.className = "release-note-body";

  for (const group of release.groups) {
    const section = document.createElement("section");
    section.className = "release-note-group";
    const heading = document.createElement("h3");
    heading.textContent = group.title;
    const items = document.createElement("ul");
    for (const item of group.items) {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      items.append(listItem);
    }
    section.append(heading, items);
    body.append(section);
  }
  details.append(summary, body);
  return details;
}

async function loadReleaseNotes(status, list) {
  if (list.dataset.loaded === "true") return;
  let markdown = FALLBACK_CHANGELOG;
  let usedFallback = false;
  try {
    const response = await fetch(CHANGELOG_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    markdown = await response.text();
  } catch {
    usedFallback = true;
  }
  const releases = parseReleaseNotes(markdown);
  list.replaceChildren(...releases.map(createReleaseItem));
  list.dataset.loaded = "true";
  if (releases.length === 0) {
    status.textContent = "표시할 릴리즈 노트가 없습니다.";
    return;
  }
  status.textContent = usedFallback
    ? `현재 버전 v${APP_VERSION}의 릴리즈 노트입니다.`
    : `최신 버전부터 총 ${releases.length}개 버전을 표시합니다.`;
}

function installReleaseNotes() {
  const aboutCard = document.querySelector('[aria-labelledby="aboutHeading"]');
  if (!aboutCard || aboutCard.dataset.releaseNotesInstalled === "true") return;
  aboutCard.dataset.releaseNotesInstalled = "true";
  ensureStylesheet();
  const buttonRow = document.createElement("div");
  buttonRow.className = "release-notes-actions";
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "outlined-button";
  openButton.textContent = "릴리즈 노트 보기";
  buttonRow.append(openButton);
  aboutCard.append(buttonRow);
  const { dialog, status, list } = createDialog();
  document.body.append(dialog);
  openButton.addEventListener("click", async () => {
    dialog.showModal();
    await loadReleaseNotes(status, list);
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installReleaseNotes, { once: true });
  else installReleaseNotes();
}
