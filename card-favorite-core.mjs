export function togglePromptFavorite(prompt, updatedAt = Date.now()) {
  if (!prompt || typeof prompt !== "object") {
    throw new TypeError("프롬프트가 필요합니다.");
  }

  return {
    ...prompt,
    isFavorite: !Boolean(prompt.isFavorite),
    updatedAt,
  };
}

export function getFavoriteMarkState(mark) {
  const active = mark?.textContent?.trim() === "★"
    || mark?.getAttribute?.("aria-pressed") === "true"
    || mark?.getAttribute?.("aria-label") === "즐겨찾기";

  return {
    active,
    symbol: active ? "★" : "☆",
    label: active ? "즐겨찾기 해제" : "즐겨찾기 등록",
  };
}
