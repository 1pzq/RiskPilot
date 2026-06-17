function normalizeForCanonicalJson(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return null;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    throw new Error('Cannot canonicalize circular data.');
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const normalizedArray = value.map((item) => normalizeForCanonicalJson(item, seen));
    seen.delete(value);
    return normalizedArray;
  }

  if (value instanceof Date) {
    seen.delete(value);
    return value.toISOString();
  }

  const record = value as Record<string, unknown>;
  const normalizedRecord = Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      const normalized = normalizeForCanonicalJson(record[key], seen);

      if (normalized !== null || Object.prototype.hasOwnProperty.call(record, key)) {
        result[key] = normalized;
      }

      return result;
    }, {});

  seen.delete(value);
  return normalizedRecord;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(normalizeForCanonicalJson(value));
}
