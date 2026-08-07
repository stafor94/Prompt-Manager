import { parseReleaseNotes } from "./release-notes-core.mjs";

const APP_VERSION = "1.2.1";
const CHANGELOG_URL = `./CHANGELOG.md?v=${APP_VERSION}`;
const FALLBACK_CHANGELOG = `
## [1.2.1] - 2026-08-07

### 변경

- 프롬프트 등록·수정 화면의 본문 입력란 기본 표시 높이를 10행에서 7행으로 줄였습니다.
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
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installReleaseNotes, { once: true });
  } else {
    installReleaseNotes();
  }
}
