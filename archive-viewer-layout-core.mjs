export const ARCHIVE_VIEWER_LAYOUT_SINGLE = "SINGLE";
export const ARCHIVE_VIEWER_LAYOUT_DUAL = "DUAL";

const VALID_LAYOUTS = new Set([
  ARCHIVE_VIEWER_LAYOUT_SINGLE,
  ARCHIVE_VIEWER_LAYOUT_DUAL,
]);

export function normalizeArchiveViewerLayout(value) {
  return VALID_LAYOUTS.has(value) ? value : ARCHIVE_VIEWER_LAYOUT_SINGLE;
}

export function resolveDualPair(index, itemCount) {
  if (!Number.isInteger(index) || !Number.isInteger(itemCount) || itemCount <= 0) return [];

  const clampedIndex = Math.min(itemCount - 1, Math.max(0, index));
  if (itemCount === 1) return [0];

  const start = Math.min(clampedIndex, itemCount - 2);
  return [start, start + 1];
}

export function resolveAdjacentDualPairStart(currentStart, itemCount, direction) {
  if (
    !Number.isInteger(currentStart)
    || !Number.isInteger(itemCount)
    || itemCount <= 0
    || ![-1, 1].includes(direction)
  ) return currentStart;

  const maxStart = Math.max(0, itemCount - 2);
  const clampedStart = Math.min(maxStart, Math.max(0, currentStart));
  const nextStart = clampedStart + (direction * 2);
  return Math.min(maxStart, Math.max(0, nextStart));
}

export function buildDualViewerCaption(items, pairIndexes) {
  if (!Array.isArray(items) || !Array.isArray(pairIndexes) || pairIndexes.length === 0) return "";

  const validIndexes = pairIndexes
    .filter((index) => Number.isInteger(index) && index >= 0 && index < items.length);
  if (validIndexes.length === 0) return "";

  const position = validIndexes.length === 1
    ? `${validIndexes[0] + 1} / ${items.length}`
    : `${validIndexes[0] + 1}–${validIndexes.at(-1) + 1} / ${items.length}`;
  const leftTitle = items[validIndexes[0]]?.promptTitle?.trim() ?? "";
  const title = leftTitle
    ? `${leftTitle}${validIndexes.length > 1 ? " 외 1" : ""}`
    : "";

  return [position, title].filter(Boolean).join(" · ");
}
