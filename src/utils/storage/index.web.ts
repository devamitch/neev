const fallback = new Map<string, string>()

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? fallback.get(key) ?? null
  } catch {
    return fallback.get(key) ?? null
  }
}

export const storage = {
  getString: read,
  set(key: string, value: string) {
    fallback.set(key, value)
    try {
      globalThis.localStorage?.setItem(key, value)
    } catch {
      // Keep session state in memory when browser storage is unavailable.
    }
  },
  delete(key: string) {
    fallback.delete(key)
    try {
      globalThis.localStorage?.removeItem(key)
    } catch {
      // Best-effort deletion for restricted browser contexts.
    }
  },
  clearAll() {
    fallback.clear()
    try {
      globalThis.localStorage?.clear()
    } catch {
      // Best-effort clearing for restricted browser contexts.
    }
  },
}
