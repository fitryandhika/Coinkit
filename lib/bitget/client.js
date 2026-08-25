import { getCache, setCache } from "./cache";

const BASE_URL = process.env.BITGET_API_BASE_URL || "https://api.bitget.com";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MIN_INTERVAL_MS = 1000;

function buildUrl(path, params = {}) {
  const url = new URL(path, BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function bitgetGet(path, params = {}, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    cacheKey = null,
    minIntervalMs = DEFAULT_MIN_INTERVAL_MS,
  } = options;

  if (cacheKey) {
    const cached = getCache(cacheKey);
    if (cached && cached.ageMs < minIntervalMs) {
      return { data: cached.value, stale: false, throttled: true };
    }
  }

  const url = buildUrl(path, params);
  let lastError = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs);
      if (!res.ok) throw new Error(`Bitget HTTP ${res.status}`);
      const json = await res.json();
      if (json.code && json.code !== "00000") {
        throw new Error(`Bitget API error ${json.code}: ${json.msg || "unknown"}`);
      }
      if (cacheKey) setCache(cacheKey, json.data);
      return { data: json.data, stale: false };
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const backoffMs = 300 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  if (cacheKey) {
    const cached = getCache(cacheKey);
    if (cached) {
      return { data: cached.value, stale: true, staleAgeMs: cached.ageMs, error: lastError?.message };
    }
  }

  throw lastError || new Error("Bitget request failed");
}
