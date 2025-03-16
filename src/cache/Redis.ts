import Redis, { RedisOptions } from 'ioredis';

class RedisClient extends Redis {
  private static instance: Redis;

  static init(): void {
    if (!RedisClient.instance) {
      const options: RedisOptions = {
        username: process.env.REDIS_USERNAME || '',
        password: process.env.REDIS_PASSWORD || '',
        host: process.env.REDIS_HOST || 'redis://localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      };

      RedisClient.instance = new Redis(options);

      RedisClient.instance.on('error', (error) => {
        console.error('Redis error:', error);
      });

      RedisClient.instance.on('connect', () => {
        console.log('Redis connected');
      });

      RedisClient.instance.on('reconnecting', () => {
        console.log('Redis reconnecting');
      });

      RedisClient.instance.on('end', () => {
        console.log('Redis connection ended');
      });
    }
  }

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.init();
    }

    return RedisClient.instance;
  }
}

export default RedisClient;
