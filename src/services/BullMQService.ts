import { Queue, Worker, Job, WorkerOptions, QueueOptions } from 'bullmq';
import IORedis from 'ioredis';
import AppException from '@errors/AppException';

interface QueueSetup {
  queue: Queue;
  worker: Worker;
}

class BullMQService {
  private static connection: IORedis | null = null;

  private static queues: Map<string, QueueSetup> = new Map();

  private static logger = {
    info: (message: string, ...args: unknown[]) =>
      console.log(`[BullMQ] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) =>
      console.error(`[BullMQ] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) =>
      console.warn(`[BullMQ] ${message}`, ...args),
  };

  static getConnection(): IORedis {
    if (!BullMQService.connection) {
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

      BullMQService.connection = new IORedis(
        `${scheme}://${auth}${host}:${port}`,
        {
          maxRetriesPerRequest: null, // required by BullMQ
          enableReadyCheck: false, // required by BullMQ
        },
      );

      BullMQService.connection.on('error', (err) => {
        BullMQService.logger.error('Redis connection error:', err.message);
      });
    }

    return BullMQService.connection;
  }

  static setupQueue(
    name: string,
    processor: (job: Job) => Promise<unknown>,
    options: {
      workerOptions?: Omit<WorkerOptions, 'connection'>;
      queueOptions?: Omit<QueueOptions, 'connection'>;
    } = {},
  ): Queue {
    if (BullMQService.queues.has(name)) {
      BullMQService.logger.warn(
        `Queue '${name}' already exists, returning existing queue`,
      );
      return BullMQService.queues.get(name)!.queue;
    }

    const connection = BullMQService.getConnection();

    const queue = new Queue(name, {
      ...options.queueOptions,
      connection,
    });

    const worker = new Worker(
      name,
      async (job) => {
        const startTime = Date.now();
        BullMQService.logger.info(
          `Processing job ${job.id} in queue '${name}'`,
        );
        try {
          const result = await processor(job);
          BullMQService.logger.info(
            `Job ${job.id} completed in ${Date.now() - startTime}ms`,
          );
          return result;
        } catch (error) {
          BullMQService.logger.error(
            `Job ${job.id} failed after ${Date.now() - startTime}ms:`,
            error,
          );
          throw error;
        }
      },
      {
        ...options.workerOptions,
        connection,
      },
    );

    worker.on('failed', (job, err) => {
      BullMQService.logger.error(
        `Job ${job?.id} failed in queue '${name}':`,
        err.message,
      );
    });

    worker.on('completed', (job) => {
      BullMQService.logger.info(
        `Job ${job.id} completed successfully in queue '${name}'`,
      );
    });

    BullMQService.queues.set(name, { queue, worker });
    BullMQService.logger.info(`Queue '${name}' set up with worker`);

    return queue;
  }

  static getQueue(name: string): Queue | null {
    return BullMQService.queues.get(name)?.queue ?? null;
  }

  static async closeQueue(name: string): Promise<void> {
    const setup = BullMQService.queues.get(name);
    if (!setup) {
      BullMQService.logger.warn(`Queue '${name}' not found`);
      return;
    }

    try {
      await setup.worker.close();
      await setup.queue.close();
      BullMQService.queues.delete(name);
      BullMQService.logger.info(`Queue '${name}' closed`);
    } catch (error) {
      BullMQService.logger.error(`Error closing queue '${name}':`, error);
    }
  }

  static async closeAllQueues(): Promise<void> {
    await Promise.all(
      Array.from(BullMQService.queues.keys()).map((name) =>
        BullMQService.closeQueue(name),
      ),
    );
  }

  static getQueueStatus(name: string) {
    const setup = BullMQService.queues.get(name);
    if (!setup) return null;

    return {
      name,
      waiting: setup.queue.getWaitingCount(),
      active: setup.queue.getActiveCount(),
      completed: setup.queue.getCompletedCount(),
      failed: setup.queue.getFailedCount(),
      delayed: setup.queue.getDelayedCount(),
    };
  }

  static async shutdown(): Promise<void> {
    await BullMQService.closeAllQueues();

    if (BullMQService.connection) {
      await BullMQService.connection.quit();
      BullMQService.connection = null;
    }

    BullMQService.logger.info('BullMQ service shut down');
  }
}

export default BullMQService;
