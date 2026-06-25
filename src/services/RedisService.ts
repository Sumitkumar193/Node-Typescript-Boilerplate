import { createClient, RedisClientType } from 'redis';
import AppException from '@errors/AppException';

class Client {
  private static instance: RedisClientType | null = null;

  private static buildConnectionUrl(): string {
    const scheme = process.env.CACHE_SECURE === 'true' ? 'rediss' : 'redis';

    const auth =
      process.env.REDIS_USERNAME && process.env.REDIS_PASSWORD
        ? `${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@`
        : '';

    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT;

    if (!host || !port) {
      throw new AppException('REDIS_HOST and REDIS_PORT must be set', 500);
    }

    return `${scheme}://${auth}${host}:${port}`;
  }

  static async init(): Promise<void> {
    if (Client.instance) return;

    const url = Client.buildConnectionUrl();

    Client.instance = createClient({ url }) as RedisClientType;

    Client.instance.on('error', (error: Error) => {
      console.error('[redis] error:', error.message);
    });

    Client.instance.on('connect', () => {
      console.log('[redis] connected');
    });

    Client.instance.on('reconnecting', () => {
      console.log('[redis] reconnecting');
    });

    Client.instance.on('end', () => {
      console.log('[redis] connection ended');
    });

    await Client.instance.connect();
  }

  static getInstance(): RedisClientType {
    if (!Client.instance) {
      throw new AppException('Redis client not initialized. Call Client.init() first.', 500);
    }

    return Client.instance;
  }

  static async disconnect(): Promise<void> {
    if (Client.instance) {
      await Client.instance.quit();
      Client.instance = null;
    }
  }
}

export default Client;