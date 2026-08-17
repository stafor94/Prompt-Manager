export const DEFAULT_ARCHIVE_IMAGE_BATCH_SIZE = 24;
export const DEFAULT_ARCHIVE_PROMPT_BATCH_LIMIT = 12;

export function prepareArchiveSummaries(summaries, activeTypes) {
  const allowedTypes = activeTypes instanceof Set ? activeTypes : new Set(activeTypes ?? []);
  return [...(Array.isArray(summaries) ? summaries : [])]
    .filter((summary) => Number.isInteger(summary?.id))
    .filter((summary) => Number.isInteger(summary?.imageCount) && summary.imageCount > 0)
    .filter((summary) => allowedTypes.has(summary.llmType))
    .sort((first, second) => (
      (second.updatedAt ?? 0) - (first.updatedAt ?? 0)
      || (second.id ?? 0) - (first.id ?? 0)
    ));
}

export function takeArchiveSummaryBatch(
  summaries,
  startIndex,
  targetImageCount = DEFAULT_ARCHIVE_IMAGE_BATCH_SIZE,
  promptLimit = DEFAULT_ARCHIVE_PROMPT_BATCH_LIMIT,
) {
  const source = Array.isArray(summaries) ? summaries : [];
  const start = Number.isInteger(startIndex) && startIndex >= 0 ? startIndex : 0;
  const target = Number.isInteger(targetImageCount) && targetImageCount > 0
    ? targetImageCount
    : DEFAULT_ARCHIVE_IMAGE_BATCH_SIZE;
  const limit = Number.isInteger(promptLimit) && promptLimit > 0
    ? promptLimit
    : DEFAULT_ARCHIVE_PROMPT_BATCH_LIMIT;

  const batch = [];
  let expectedImageCount = 0;
  let nextIndex = start;

  while (
    nextIndex < source.length
    && batch.length < limit
    && (batch.length === 0 || expectedImageCount < target)
  ) {
    const summary = source[nextIndex];
    batch.push(summary);
    expectedImageCount += Math.max(0, Number(summary?.imageCount) || 0);
    nextIndex += 1;
  }

  return {
    batch,
    nextIndex,
    hasMore: nextIndex < source.length,
    expectedImageCount,
  };
}

export function splitArchiveImagesForFilledRows(
  images,
  currentImageCount,
  columnCount,
  hasMoreImages,
) {
  const source = Array.isArray(images) ? images : [];
  const current = Number.isInteger(currentImageCount) && currentImageCount >= 0 ? currentImageCount : 0;
  const requestedColumns = Number(columnCount);
  const columns = [2, 3, 4, 6].includes(requestedColumns) ? requestedColumns : 3;

  if (!hasMoreImages) {
    return { visibleImages: [...source], pendingImages: [] };
  }

  const currentRemainder = current % columns;
  let visibleCount = 0;
  if (currentRemainder > 0) {
    const neededToFillRow = columns - currentRemainder;
    if (source.length >= neededToFillRow) visibleCount = neededToFillRow;
  } else {
    visibleCount = source.length - (source.length % columns);
  }

  return {
    visibleImages: source.slice(0, visibleCount),
    pendingImages: source.slice(visibleCount),
  };
}

export function getArchiveTotals(summaries) {
  const source = Array.isArray(summaries) ? summaries : [];
  return {
    promptCount: source.length,
    imageCount: source.reduce((sum, summary) => sum + Math.max(0, Number(summary?.imageCount) || 0), 0),
  };
}
