import { createClient, RedisClientType } from 'redis';
import { CacheStorage } from '../../interfaces/CacheInterface';

const CACHE_TTL = parseInt(process.env.CACHE_TTL || '300', 10);

class RedisCache implements CacheStorage {
  private CACHE_TTL: number;

  private client: RedisClientType;

  private isConnecting: boolean = false;

  private isConnected: boolean = false;

  private static redisClient: RedisClientType;

  constructor() {
    this.CACHE_TTL = CACHE_TTL;

    if (!RedisCache.redisClient) {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      // Store in static property for later access
      RedisCache.redisClient = this.client;

      // Set up event listeners only once
      this.client.on('error', (err) => {
        console.error('Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.isConnecting = false;
        console.log('Redis connected successfully');
      });

      this.client.on('end', () => {
        this.isConnected = false;
        console.log('Redis connection closed');
      });
    } else {
      // Reuse existing client
      this.client = RedisCache.redisClient;
    }

    // Connect only if not already connected or attempting connection
    this.ensureConnection();
  }

  private async ensureConnection(): Promise<void> {
    // Only attempt to connect if not already connected or in the process of connecting
    if (!this.isConnected && !this.isConnecting) {
      this.isConnecting = true;
      try {
        await this.client.connect();
      } catch (err) {
        console.error('Redis connection error:', err);
        this.isConnecting = false;
      }
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.client.get(key);
      if (!value) return undefined;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Redis get error:', error);
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttl = this.CACHE_TTL): Promise<void> {
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async delete(cacheName: string): Promise<boolean> {
    try {
      const result = await this.client.del(cacheName);
      return result > 0;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.client.exists(key);
      return exists > 0;
    } catch (error) {
      console.error('Redis has error:', error);
      return false;
    }
  }

  async keys(): Promise<string[]> {
    try {
      return await this.client.keys('*');
    } catch (error) {
      console.error('Redis keys error:', error);
      return [];
    }
  }

  async match(request: Request): Promise<Response | undefined> {
    try {
      const key = new URL(request.url).pathname;
      const cachedData = await this.get<{
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body: string;
      }>(key);

      if (!cachedData) return undefined;

      return new Response(cachedData.body, {
        status: cachedData.status,
        statusText: cachedData.statusText,
        headers: cachedData.headers,
      });
    } catch (error) {
      console.error('Redis match error:', error);
      return undefined;
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      const keys = await this.client.keys(pattern || '*');
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  async open(cacheName: string): Promise<never> {
    this.clear();
    console.warn(`Cache "${cacheName}" cannot be opened in this.`);
    throw new Error('Method not implemented in RedisCache');
  }

  static async closeConnection(): Promise<void> {
    if (RedisCache.redisClient) {
      try {
        await RedisCache.redisClient.quit();
        console.log('Redis connection closed gracefully');
      } catch (error) {
        console.error('Error closing Redis connection:', error);
      }
    }
  }
}

export default RedisCache;
