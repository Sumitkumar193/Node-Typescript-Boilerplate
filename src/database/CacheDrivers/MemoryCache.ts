import { CacheStorage } from '../../interfaces/CacheInterface';

const CACHE_TTL = parseInt(process.env.CACHE_TTL || '300', 10);

class MemoryCache implements CacheStorage {
  private CACHE_TTL: number;

  private cache: Map<string, { value: unknown; expires: number }>;

  constructor() {
    this.CACHE_TTL = CACHE_TTL;
    this.cache = new Map<string, { value: unknown; expires: number }>();
  }

  async get<T>(key: string): Promise<T | undefined> {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // Check if item has expired
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value as T;
  }

  async set<T>(key: string, value: T, ttl = this.CACHE_TTL): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.cache.delete(cacheName);
  }

  async has(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;

    // Check if item has expired
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async keys(): Promise<string[]> {
    // Filter out expired keys
    const currentTime = Date.now();
    const validKeys: string[] = [];

    this.cache.forEach((item, key) => {
      if (item.expires >= currentTime) {
        validKeys.push(key);
      } else {
        this.cache.delete(key);
      }
    });

    return validKeys;
  }

  async match(request: Request): Promise<Response | undefined> {
    // Implementation depends on how you want to match requests
    // This is a basic implementation
    const key = request.url;
    const value = await this.get<Response>(key);
    return value;
  }

  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      const regex = new RegExp(pattern);
      Array.from(this.cache.keys()).forEach((key) => {
        if (regex.test(key)) {
          this.cache.delete(key);
        }
      });
    } else {
      this.cache.clear();
    }
  }

  // Required by CacheStorage interface
  async open(cacheName: string): Promise<never> {
    this.clear();
    console.warn(`Cache "${cacheName}" cannot be opened in MemoryCache.`);
    throw new Error('Method not implemented in MemoryCache');
  }
}

export default MemoryCache;
