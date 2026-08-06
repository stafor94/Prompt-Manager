import { formatQuotaInSummary } from "./storage-quota.mjs";

export function applyStorageQuotaUnit(element) {
  if (!element) return false;
  const current = element.textContent ?? "";
  const formatted = formatQuotaInSummary(current);
  if (formatted === current) return false;
  element.textContent = formatted;
  return true;
}

function installStorageQuotaFormatter() {
  const summary = document.querySelector("#storageSummary");
  if (!summary || summary.dataset.quotaFormatterInstalled === "true") return;

  summary.dataset.quotaFormatterInstalled = "true";
  applyStorageQuotaUnit(summary);

  const observer = new MutationObserver(() => {
    applyStorageQuotaUnit(summary);
  });
  observer.observe(summary, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installStorageQuotaFormatter, { once: true });
  } else {
    installStorageQuotaFormatter();
  }
}
