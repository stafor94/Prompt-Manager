export function normalizePromptTitle(title) {
  return String(title ?? "").trim().normalize("NFC");
}

export function isValidPromptVersion(version) {
  return Number.isInteger(version) && version >= 1;
}

function getSortablePromptId(prompt) {
  return Number.isInteger(prompt?.id) && prompt.id >= 0
    ? prompt.id
    : Number.MAX_SAFE_INTEGER;
}

function compareByCreatedAtThenId(a, b) {
  const createdDifference = (Number(a.prompt.createdAt) || 0) - (Number(b.prompt.createdAt) || 0);
  if (createdDifference !== 0) return createdDifference;

  const aId = getSortablePromptId(a.prompt);
  const bId = getSortablePromptId(b.prompt);
  if (aId !== bId) return aId - bId;

  return a.index - b.index;
}

function compareByIdThenCreatedAt(a, b) {
  const aId = getSortablePromptId(a.prompt);
  const bId = getSortablePromptId(b.prompt);
  if (aId !== bId) return aId - bId;
  return compareByCreatedAtThenId(a, b);
}

export function assignPromptVersions(prompts) {
  const normalizedPrompts = prompts.map((prompt) => ({ ...prompt }));
  const groups = new Map();

  normalizedPrompts.forEach((prompt, index) => {
    const key = normalizePromptTitle(prompt.title);
    const group = groups.get(key) ?? [];
    group.push({ prompt, index });
    groups.set(key, group);
  });

  const changedIndexes = [];

  groups.forEach((group) => {
    const usedVersions = new Set();
    let maximumVersion = 0;
    const pending = [];

    [...group].sort(compareByIdThenCreatedAt).forEach((entry) => {
      const version = entry.prompt.version;
      if (isValidPromptVersion(version) && !usedVersions.has(version)) {
        usedVersions.add(version);
        maximumVersion = Math.max(maximumVersion, version);
      } else {
        pending.push(entry);
      }
    });

    pending.sort(compareByCreatedAtThenId).forEach((entry) => {
      do {
        maximumVersion += 1;
      } while (usedVersions.has(maximumVersion));

      entry.prompt.version = maximumVersion;
      usedVersions.add(maximumVersion);
      changedIndexes.push(entry.index);
    });
  });

  return {
    prompts: normalizedPrompts,
    changedIndexes: [...new Set(changedIndexes)].sort((a, b) => a - b),
  };
}

export function getPromptVersion(prompt) {
  return isValidPromptVersion(prompt?.version) ? prompt.version : 1;
}

export function getNextPromptVersion(prompts, title, excludedPromptId = null) {
  const titleKey = normalizePromptTitle(title);
  let maximumVersion = 0;

  prompts.forEach((prompt) => {
    if (excludedPromptId !== null && prompt.id === excludedPromptId) return;
    if (normalizePromptTitle(prompt.title) !== titleKey) return;
    if (isValidPromptVersion(prompt.version)) {
      maximumVersion = Math.max(maximumVersion, prompt.version);
    }
  });

  return maximumVersion + 1;
}

export function resolvePromptVersion(prompts, title, previousPrompt = null) {
  if (previousPrompt
    && normalizePromptTitle(previousPrompt.title) === normalizePromptTitle(title)) {
    return getPromptVersion(previousPrompt);
  }

  return getNextPromptVersion(prompts, title, previousPrompt?.id ?? null);
}
