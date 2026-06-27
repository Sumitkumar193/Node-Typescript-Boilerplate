import {
  Queue,
  Worker,
  Job,
  WorkerOptions,
  QueueOptions,
  JobsOptions,
} from 'bullmq';
import IORedis from 'ioredis';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import AppException from '@errors/AppException';
import prisma from '@database/Prisma';
import { JobLog, Prisma } from '@prisma/client';
import { JobStatus } from '@interfaces/JobLogInterface';

const ENC_PREFIX = 'enc:';

export function encryptJobPayload(data: unknown): unknown {
  const key = process.env.JOB_ENCRYPTION_KEY;
  if (!key) throw new Error('JOB_ENCRYPTION_KEY env var is required');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const enc = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final(),
  ]);
  return (
    ENC_PREFIX +
    Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64')
  );
}

export function decryptJobPayload(data: unknown): unknown {
  const key = process.env.JOB_ENCRYPTION_KEY;
  if (!key || typeof data !== 'string' || !data.startsWith(ENC_PREFIX))
    return data;
  // prefix present → this is our encrypted format; let auth errors propagate
  const buf = Buffer.from(data.slice(ENC_PREFIX.length), 'base64');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(key, 'hex'),
    buf.subarray(0, 12),
  );
  decipher.setAuthTag(buf.subarray(12, 28));
  return JSON.parse(decipher.update(buf.subarray(28)) + decipher.final('utf8'));
}

interface QueueSetup {
  queue: Queue;
  worker: Worker;
}

class BullMQService {
  private static connection: IORedis | null = null;

  private static queues: Map<string, QueueSetup> = new Map();

  // getter so env var set at runtime (e.g. in tests) takes effect immediately
  private static get dbLoggingEnabled() {
    return process.env.BULLMQ_DB_LOGGING === 'true';
  }

  private static logger = {
    info: (message: string, ...args: unknown[]) =>
      console.log(`[BullMQ] ${message}`, ...args),
    error: (message: string, ...args: unknown[]) =>
      console.error(`[BullMQ] ${message}`, ...args),
    warn: (message: string, ...args: unknown[]) =>
      console.warn(`[BullMQ] ${message}`, ...args),
  };

  private static async logJobToDatabase(
    data: Prisma.JobLogUncheckedCreateInput,
  ): Promise<void> {
    if (!BullMQService.dbLoggingEnabled) return;

    const { jobId, queue } = data;
    if (!jobId) return; // BullMQ always assigns IDs; defensive guard

    try {
      await prisma.jobLog.upsert({
        where: { queue_jobId: { queue, jobId } },
        update: {
          status: data.status,
          result: data.result,
          attempts: data.attempts,
          startedAt: data.startedAt,
          finishedAt: data.finishedAt,
          failedAt: data.failedAt,
          failedReason: data.failedReason,
          updatedAt: new Date(),
        },
        create: data,
      });
    } catch (error) {
      BullMQService.logger.error('Failed to log job to database:', error);
    }
  }

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
        const startedAt = new Date();
        // Capture encrypted form for DB logging, then decrypt in-place for the processor
        const encryptedPayload = job.data as unknown;
        Reflect.set(job, 'data', decryptJobPayload(encryptedPayload));

        await BullMQService.logJobToDatabase({
          queue: name,
          jobId: job.id?.toString(),
          name: job.name,
          status: 'processing',
          payload: encryptedPayload as Prisma.InputJsonValue,
          attempts: job.attemptsMade,
          maxAttempts: job.opts.attempts,
          startedAt,
        });

        BullMQService.logger.info(
          `Processing job ${job.id} in queue '${name}' (attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? '∞'})`,
        );
        try {
          const result = await processor(job);
          const finishedAt = new Date();

          await BullMQService.logJobToDatabase({
            queue: name,
            jobId: job.id?.toString(),
            name: job.name,
            status: 'completed',
            payload: encryptedPayload as Prisma.InputJsonValue,
            result: result as Prisma.InputJsonValue,
            attempts: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts,
            startedAt,
            finishedAt,
          });

          BullMQService.logger.info(
            `Job ${job.id} completed in ${Date.now() - startTime}ms`,
          );
          return result;
        } catch (error) {
          const failedAt = new Date();

          await BullMQService.logJobToDatabase({
            queue: name,
            jobId: job.id?.toString(),
            name: job.name,
            status: 'failed',
            payload: encryptedPayload as Prisma.InputJsonValue,
            attempts: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts,
            startedAt,
            failedAt,
            failedReason:
              error instanceof Error ? error.message : String(error),
          });

          BullMQService.logger.error(
            `Job ${job.id} failed after ${Date.now() - startTime}ms:`,
            error,
          );
          BullMQService.logger.info(
            job.attemptsMade === 0
              ? `Job ${job.id} will be automatically retried in 5 minutes`
              : `Job ${job.id} has failed after retry attempts`,
          );
          throw error;
        }
      },
      {
        ...options.workerOptions,
        connection,
        settings: {
          backoffStrategy: (attemptsMade: number) =>
            attemptsMade === 1
              ? 300000
              : Math.min(1000 * 2 ** attemptsMade, 30000),
          ...options.workerOptions?.settings,
        },
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

  static async addJobToQueue(
    queueName: string,
    jobName: string,
    data: object,
    opts?: JobsOptions,
  ): Promise<string | undefined> {
    const queue = BullMQService.getQueue(queueName);
    if (!queue) {
      BullMQService.logger.error(`Queue '${queueName}' not found`);
      return undefined;
    }

    try {
      const payload = encryptJobPayload(data);
      const job = await queue.add(jobName, payload, opts);

      await BullMQService.logJobToDatabase({
        queue: queueName,
        jobId: job.id?.toString(),
        name: jobName,
        status: 'pending',
        payload: payload as Prisma.InputJsonValue,
        maxAttempts: opts?.attempts,
      });

      return job.id?.toString();
    } catch (error) {
      BullMQService.logger.error(
        `Failed to add job to queue '${queueName}':`,
        error,
      );
      throw error;
    }
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

  static async getJobLogs(
    filters: {
      queue?: string;
      status?: JobStatus;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<JobLog[]> {
    try {
      const where: { queue?: string; status?: string } = {};
      if (filters.queue) where.queue = filters.queue;
      if (filters.status) where.status = filters.status;

      return await prisma.jobLog.findMany({
        where,
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      BullMQService.logger.error(
        'Failed to retrieve job logs from database:',
        error,
      );
      return [];
    }
  }

  static async getJobLogById(id: number): Promise<JobLog | null> {
    try {
      return await prisma.jobLog.findUnique({ where: { id } });
    } catch (error) {
      BullMQService.logger.error(
        `Failed to retrieve job log ${id} from database:`,
        error,
      );
      return null;
    }
  }

  static async closeAllQueues(): Promise<void> {
    await Promise.all(
      Array.from(BullMQService.queues.keys()).map((name) =>
        BullMQService.closeQueue(name),
      ),
    );
  }

  static async replayJobById(jobLogId: number): Promise<string | null> {
    try {
      const jobLog = await prisma.jobLog.findUnique({
        where: { id: jobLogId },
      });

      if (!jobLog) {
        BullMQService.logger.error(`Job log with ID ${jobLogId} not found`);
        return null;
      }

      if (jobLog.status !== 'failed') {
        BullMQService.logger.warn(
          `Cannot replay job ${jobLogId} in status '${jobLog.status}'`,
        );
        return null;
      }

      const queue = BullMQService.getQueue(jobLog.queue);
      if (!queue) {
        BullMQService.logger.error(`Queue '${jobLog.queue}' not found`);
        return null;
      }

      const job = await queue.add(
        jobLog.name || 'replayed-job',
        jobLog.payload ?? {},
        {
          attempts: jobLog.maxAttempts || 3,
          backoff: { type: 'fixed', delay: 300000 },
        },
      );

      BullMQService.logger.info(
        `Job ${jobLogId} replayed as new job ${job.id} in queue '${jobLog.queue}'`,
      );

      await BullMQService.logJobToDatabase({
        queue: jobLog.queue,
        jobId: job.id?.toString(),
        name: jobLog.name ?? undefined,
        status: 'pending',
        payload: jobLog.payload ?? Prisma.JsonNull,
        maxAttempts: jobLog.maxAttempts ?? undefined,
      });

      return job.id?.toString() || null;
    } catch (error) {
      BullMQService.logger.error(`Failed to replay job ${jobLogId}:`, error);
      return null;
    }
  }

  static async getBullMQJobById(
    queueName: string,
    jobId: string,
  ): Promise<Job | null> {
    const queue = BullMQService.getQueue(queueName);
    if (!queue) {
      BullMQService.logger.error(`Queue '${queueName}' not found`);
      return null;
    }

    try {
      const job = await queue.getJob(jobId);
      return job || null;
    } catch (error) {
      BullMQService.logger.error(
        `Failed to get job ${jobId} from queue '${queueName}':`,
        error,
      );
      return null;
    }
  }

  static async retryJob(queueName: string, jobId: string): Promise<boolean> {
    try {
      const job = await BullMQService.getBullMQJobById(queueName, jobId);
      if (!job) {
        BullMQService.logger.error(
          `Job ${jobId} not found in queue '${queueName}'`,
        );
        return false;
      }

      const state = await job.getState();
      if (state === 'completed') {
        BullMQService.logger.warn(`Cannot retry completed job ${jobId}`);
        return false;
      }

      await job.retry();
      BullMQService.logger.info(`Job ${jobId} retried successfully`);
      return true;
    } catch (error) {
      BullMQService.logger.error(`Failed to retry job ${jobId}:`, error);
      return false;
    }
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
