export function moveImageById(images, sourceId, targetId, placement = "before") {
  if (!Array.isArray(images) || sourceId === targetId) return images;
  const sourceIndex = images.findIndex((image) => image?.id === sourceId);
  const targetIndex = images.findIndex((image) => image?.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return images;

  const reordered = images.slice();
  const [moved] = reordered.splice(sourceIndex, 1);
  const remainingTargetIndex = reordered.findIndex((image) => image?.id === targetId);
  const insertIndex = remainingTargetIndex + (placement === "after" ? 1 : 0);
  reordered.splice(insertIndex, 0, moved);
  return reordered;
}
