import Redis from 'ioredis';
import Valkey from 'iovalkey';
import AppException from '@errors/AppException';

class Client {
  private static instance: Redis | Valkey;

  static init(): void {
    try {
      if (!Client.instance) {
        const buildUrl = `${process.env.CACHE_SECURE === 'true' ? 'rediss' : 'redis'}://${
          process.env.REDIS_USERNAME
            ? `${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@`
            : ''
        }${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;

        if (process.env.CACHE_DRIVER === 'redis') {
          Client.instance = new Redis(buildUrl);
        } else if (process.env.CACHE_DRIVER === 'valkey') {
          Client.instance = new Valkey(buildUrl);
        } else {
          throw new AppException('Cache driver not supported', 500);
        }

        Client.instance.on('error', (error) => {
          console.error(`${process.env.CACHE_DRIVER} error:`, error);
        });

        Client.instance.on('connect', () => {
          console.log(`${process.env.CACHE_DRIVER} connected`);
        });

        Client.instance.on('reconnecting', () => {
          console.log(`${process.env.CACHE_DRIVER} reconnecting`);
        });

        Client.instance.on('end', () => {
          console.log(`${process.env.CACHE_DRIVER} connection ended`);
        });
      }
    } catch (error) {
      if (error instanceof AppException) {
        console.error('Cache initialization error:', error.message);
      } else {
        console.log('Cache connection error:', error);
      }
    }
  }

  static getInstance(): Redis | Valkey {
    if (!Client.instance) {
      Client.init();
    }

    return Client.instance;
  }
}

export default Client;
