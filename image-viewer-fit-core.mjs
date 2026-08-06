export const BASE_VIEWER_TRANSFORM = "translate3d(0, 0, 0) scale(1)";

export function getViewerScale(transform) {
  if (typeof transform !== "string") return 1;
  const match = transform.match(/scale\(([-+\d.]+)\)/);
  if (!match) return 1;
  const scale = Number(match[1]);
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function hasViewerTranslation(transform) {
  if (typeof transform !== "string") return false;
  const match = transform.match(/translate3d\(\s*([-+\d.]+)px\s*,\s*([-+\d.]+)px/i);
  if (!match) return false;
  return Math.abs(Number(match[1])) > 0.01 || Math.abs(Number(match[2])) > 0.01;
}

export function shouldResetViewerTransform(transform) {
  return getViewerScale(transform) > 1.001 || hasViewerTranslation(transform);
}
