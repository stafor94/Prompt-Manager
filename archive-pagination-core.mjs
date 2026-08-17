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

export function getArchiveTotals(summaries) {
  const source = Array.isArray(summaries) ? summaries : [];
  return {
    promptCount: source.length,
    imageCount: source.reduce((sum, summary) => sum + Math.max(0, Number(summary?.imageCount) || 0), 0),
  };
}
