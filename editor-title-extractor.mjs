const TITLE_MARKER_PATTERN = /^[\s\p{P}\p{S}]*(?:제목|타이틀)(?![\p{L}\p{N}])(?<rest>.*)$/u;
const DECORATION_ONLY_PATTERN = /^[\s\p{P}\p{S}]*$/u;
const SECTION_HEADER_PATTERN = /^\s*(?:\[[^\]\r\n]+\]|【[^】\r\n]+】|〈[^〉\r\n]+〉|《[^》\r\n]+》|#{1,6}\s+\S.*)\s*$/u;

function normalizeLines(text) {
  return String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
}

function trimMarkerDecoration(value) {
  return value.replace(/^[\s\p{P}\p{S}]+/u, "").trim();
}

function truncateByCharacters(value, maxLength) {
  if (!Number.isInteger(maxLength) || maxLength <= 0) return value;
  return [...value].slice(0, maxLength).join("");
}

export function extractTitleFromPromptText(text, options = {}) {
  const lines = normalizeLines(text);
  const maxLength = options.maxLength;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(TITLE_MARKER_PATTERN);
    if (!match) continue;

    const rest = match.groups?.rest ?? "";
    const sameLineTitle = DECORATION_ONLY_PATTERN.test(rest)
      ? ""
      : trimMarkerDecoration(rest);

    if (sameLineTitle) {
      return truncateByCharacters(sameLineTitle, maxLength);
    }

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const candidate = lines[nextIndex].trim();
      if (!candidate) continue;
      if (SECTION_HEADER_PATTERN.test(candidate)) return "";
      return truncateByCharacters(candidate, maxLength);
    }

    return "";
  }

  return "";
}
