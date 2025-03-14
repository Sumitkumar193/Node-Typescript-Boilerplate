export interface CacheStorage {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(cacheName: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
  match(request: Request): Promise<Response | undefined>;
  clear(pattern?: string): Promise<void>;
  open(cacheName: string): Promise<never>;
}
