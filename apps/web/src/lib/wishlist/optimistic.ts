export function nextWishlistIds(
  ids: ReadonlySet<string>,
  propertyId: string,
): { next: Set<string>; action: 'added' | 'removed' } {
  const next = new Set(ids);
  if (next.has(propertyId)) {
    next.delete(propertyId);
    return { next, action: 'removed' };
  }
  next.add(propertyId);
  return { next, action: 'added' };
}

export function rollbackWishlistIds(
  ids: ReadonlySet<string>,
  propertyId: string,
  action: 'added' | 'removed',
): Set<string> {
  const next = new Set(ids);
  if (action === 'added') {
    next.delete(propertyId);
  } else {
    next.add(propertyId);
  }
  return next;
}
