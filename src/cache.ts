interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export const TAXONOMY_TTL = 86_400_000;  // 24h — category structure rarely changes
export const FAVOURITES_TTL = 3_600_000; // 1h — favourites list changes infrequently
export const ORDERS_TTL = 3_600_000;     // 1h — order history is append-only
export const WEEKS_TTL = 1_800_000;      // 30m — slot availability shifts during the day

class Cache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }
}

export const cache = new Cache();
