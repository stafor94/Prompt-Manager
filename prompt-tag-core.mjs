function normalizeSearchValue(value) {
  return String(value ?? "").toLocaleLowerCase("ko-KR");
}

export function matchesPromptQuery(prompt, query, tags = []) {
  const normalizedQuery = normalizeSearchValue(query).trim();
  if (!normalizedQuery) return true;

  return [prompt?.title, prompt?.content, ...tags]
    .some((value) => normalizeSearchValue(value).includes(normalizedQuery));
}

export function collectTagOptions(prompts, getTags = (prompt) => prompt?.tags ?? []) {
  const tagCounts = new Map();

  for (const prompt of prompts ?? []) {
    for (const tag of getTags(prompt)) {
      const label = String(tag ?? "").trim();
      if (!label) continue;
      const key = label.toLocaleLowerCase("ko-KR");
      const current = tagCounts.get(key) ?? { label, count: 0 };
      current.count += 1;
      tagCounts.set(key, current);
    }
  }

  return [...tagCounts.values()]
    .sort((first, second) => second.count - first.count
      || first.label.localeCompare(second.label, "ko-KR", { sensitivity: "base" }));
}
