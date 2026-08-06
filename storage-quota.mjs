const QUOTA_PATTERN = /(할당량 약\s*)([\d,.]+)\s*MB\b/;

function parseMegabytes(value) {
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatDecimal(value) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatQuotaMegabytes(megabytes) {
  const parsed = parseMegabytes(megabytes);
  if (parsed === null) return null;
  if (parsed < 1000) return `${formatDecimal(parsed)}MB`;
  return `${formatDecimal(parsed / 1000)}GB`;
}

export function formatQuotaInSummary(summary) {
  if (typeof summary !== "string") return summary;

  return summary.replace(QUOTA_PATTERN, (matched, prefix, rawMegabytes) => {
    const parsed = parseMegabytes(rawMegabytes);
    if (parsed === null || parsed < 1000) return matched;
    return `${prefix}${formatQuotaMegabytes(parsed)}`;
  });
}
