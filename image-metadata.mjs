function toPositiveInteger(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.trunc(number);
}

export function greatestCommonDivisor(first, second) {
  let a = toPositiveInteger(first);
  let b = toPositiveInteger(second);
  if (!a || !b) return 0;

  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}

export function formatAspectRatio(width, height) {
  const resolvedWidth = toPositiveInteger(width);
  const resolvedHeight = toPositiveInteger(height);
  if (!resolvedWidth || !resolvedHeight) return "";

  const divisor = greatestCommonDivisor(resolvedWidth, resolvedHeight);
  if (!divisor) return "";
  return `${resolvedWidth / divisor}:${resolvedHeight / divisor}`;
}

export function formatResolution(width, height) {
  const resolvedWidth = toPositiveInteger(width);
  const resolvedHeight = toPositiveInteger(height);
  if (!resolvedWidth || !resolvedHeight) return "";
  return `${resolvedWidth}×${resolvedHeight}`;
}

export function formatImageMetadata(width, height) {
  const ratio = formatAspectRatio(width, height);
  const resolution = formatResolution(width, height);
  if (!ratio || !resolution) return "";
  return `비율 ${ratio} · ${resolution}`;
}
