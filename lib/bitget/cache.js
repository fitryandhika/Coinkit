const store = new Map();

export function setCache(key, value) {
  store.set(key, { value, timestamp: Date.now() });
}

export function getCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  return { value: entry.value, ageMs: Date.now() - entry.timestamp };
}
