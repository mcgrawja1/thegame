/** Tiny in-memory TTL cache. Good enough for one process; swap for Redis if you scale out. */
export class TtlCache<V> {
  private store = new Map<string, { expires: number; value: V }>();

  constructor(private ttlMs: number, private maxEntries = 500) {}

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { expires: Date.now() + this.ttlMs, value });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
