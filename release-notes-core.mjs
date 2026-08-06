function cleanInlineText(value) {
  return value.replaceAll("`", "").trim();
}

export function parseReleaseNotes(markdown) {
  if (typeof markdown !== "string") return [];

  const releases = [];
  let currentRelease = null;
  let currentGroup = null;

  for (const rawLine of markdown.replaceAll("\r\n", "\n").split("\n")) {
    const line = rawLine.trim();
    const releaseMatch = line.match(/^## \[([^\]]+)](?:\s*-\s*(.+))?$/);

    if (releaseMatch) {
      currentRelease = {
        version: releaseMatch[1].trim(),
        date: releaseMatch[2]?.trim() ?? "",
        groups: [],
      };
      currentGroup = null;
      releases.push(currentRelease);
      continue;
    }

    if (line.startsWith("## ")) {
      currentRelease = null;
      currentGroup = null;
      continue;
    }

    if (!currentRelease) continue;

    const groupMatch = line.match(/^###\s+(.+)$/);
    if (groupMatch) {
      currentGroup = {
        title: cleanInlineText(groupMatch[1]),
        items: [],
      };
      currentRelease.groups.push(currentGroup);
      continue;
    }

    const itemMatch = line.match(/^-\s+(.+)$/);
    if (!itemMatch) continue;

    if (!currentGroup) {
      currentGroup = { title: "변경", items: [] };
      currentRelease.groups.push(currentGroup);
    }
    currentGroup.items.push(cleanInlineText(itemMatch[1]));
  }

  return releases
    .map((release) => ({
      ...release,
      groups: release.groups.filter((group) => group.items.length > 0),
    }))
    .filter((release) => release.groups.length > 0);
}
