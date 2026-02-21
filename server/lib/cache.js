export class TTLCache {
  constructor(defaultTtlMs = 60_000) {
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map();
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
    return value;
  }

  getOrSet(key, resolver, ttlMs = this.defaultTtlMs) {
    const cached = this.get(key);
    if (cached !== null) return Promise.resolve(cached);

    return Promise.resolve(resolver()).then((value) => this.set(key, value, ttlMs));
  }
}
