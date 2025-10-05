import { Queue, Worker, Job, WorkerOptions, QueueOptions } from 'bullmq';
import RedisClient from '@services/RedisService';

interface QueueSetup {
  queue: Queue;
  worker: Worker;
}

class BullMQService {
  private static redisConnection: RedisClient | null = null;

  private static queues: Map<string, QueueSetup> = new Map();

  private static logger = {
    info: (message: string, ...args: unknown[]) =>
      console.log(`[BullMQ] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) =>
      console.error(`[BullMQ] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) =>
      console.warn(`[BullMQ] ${message}`, ...args),
  };

  static getConnection(): RedisClient {
    if (!BullMQService.redisConnection) {
      const connection = RedisClient.getInstance();
      if (!connection) {
        throw new Error('Redis connection not initialized');
      }
      BullMQService.redisConnection = connection;
    }

    return BullMQService.redisConnection;
  }

  static setupQueue(
    name: string,
    processor: (job: Job) => Promise<unknown>,
    options: {
      workerOptions?: WorkerOptions;
      queueOptions?: QueueOptions;
    } = {},
  ): Queue {
    if (BullMQService.queues.has(name)) {
      BullMQService.logger.warn(
        `Queue '${name}' already exists, returning existing queue`,
      );
      return BullMQService.queues.get(name)!.queue;
    }

    const queue = new Queue(name, {
      connection: BullMQService.getConnection(),
      ...options.queueOptions,
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
          const duration = Date.now() - startTime;
          BullMQService.logger.info(`Job ${job.id} completed in ${duration}ms`);
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          BullMQService.logger.error(
            `Job ${job.id} failed after ${duration}ms:`,
            error,
          );
          throw error;
        }
      },
      {
        connection: BullMQService.getConnection(),
        ...options.workerOptions,
      },
    );

    worker.on('failed', (job, err) => {
      BullMQService.logger.error(
        `Job ${job?.id} failed in queue '${name}':`,
        err,
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
    const setup = BullMQService.queues.get(name);
    return setup ? setup.queue : null;
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
    const queueNames = Array.from(BullMQService.queues.keys());
    await Promise.all(queueNames.map((name) => BullMQService.closeQueue(name)));
    BullMQService.logger.info('All queues closed');
  }

  static getQueueStatus(name: string) {
    const setup = BullMQService.queues.get(name);
    if (!setup) {
      return null;
    }

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
    BullMQService.logger.info('BullMQ service shut down');
  }
}

export default BullMQService;
