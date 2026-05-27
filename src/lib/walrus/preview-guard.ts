export function hasWhatIfPreviewMarker(value: unknown, seen = new WeakSet<object>()): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);
  const record = value as Record<string, unknown>;

  if (record.previewOnly === true || record.source === 'what_if_preview') {
    return true;
  }

  return Object.values(record).some((entry) => hasWhatIfPreviewMarker(entry, seen));
}

export function assertNoWhatIfPreviewPayload(value: unknown, message: string): void {
  if (hasWhatIfPreviewMarker(value)) {
    throw new Error(message);
  }
}
