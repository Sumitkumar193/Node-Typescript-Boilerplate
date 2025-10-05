import ejs from 'ejs';
import Mailer from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { Job, Queue } from 'bullmq';
import { MailJobData } from '@interfaces/AppCommonInterface';
import BullMQService from '@services/BullMQService';
import AppException from '@errors/AppException';

const QUEUE_NAME = process.env.MAIL_QUEUE_NAME || 'mail-queue';
const QUEUE_ATTEMPTS = parseInt(process.env.MAIL_QUEUE_ATTEMPTS || '3', 10);
const QUEUE_BACKOFF = parseInt(process.env.MAIL_QUEUE_BACKOFF || '5000', 10);
const WORKER_CONCURRENCY = parseInt(
  process.env.MAIL_WORKER_CONCURRENCY || '2',
  10,
);

export default class MailService {
  private static instance: Mailer.Transporter;

  private static queue: Queue | null = null;

  static init() {
    if (!MailService.instance) {
      const options: SMTPTransport.Options = {};
      const serviceType = process.env.MAIL_SERVICE;

      if (serviceType === 'sendgrid') {
        options.service = serviceType;
      } else if (serviceType === 'smtp') {
        options.host = process.env.MAIL_HOST;
        options.port = parseInt(process.env.MAIL_PORT ?? '587', 10);
        options.secure = process.env.MAIL_SECURE === 'true';
      } else {
        return console.error('MAIL_SERVICE not configured properly.');
      }

      const transporter = Mailer.createTransport({
        ...options,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      });

      transporter.verify((error: Error | null) => {
        if (error) console.error(error);
        else console.log('Mail server ready.');
      });

      MailService.instance = transporter;
      MailService.queue = BullMQService.setupQueue(
        QUEUE_NAME,
        async (job: Job<MailJobData>) => {
          await MailService._sendNow(job.data);
          return { success: true, duration: Date.now() - job.timestamp };
        },
        {
          workerOptions: {
            concurrency: WORKER_CONCURRENCY,
            connection: BullMQService.getConnection(),
          },
        },
      );
    }

    return MailService.instance;
  }

  static async _sendNow(data: MailJobData): Promise<void> {
    if (!MailService.instance) MailService.init();

    const mailOptions: MailJobData = {
      ...data,
      from: process.env.MAIL_FROM,
    };

    return new Promise((resolve, reject) => {
      MailService.instance!.sendMail(mailOptions, (error, info) => {
        if (error) reject(error);
        else resolve(info);
      });
    });
  }

  static async send(data: MailJobData): Promise<void> {
    try {
      const { queue } = MailService;
      let { html } = data;

      if (data.template) {
        const templatePath = `./src/templates/${data.template}.ejs`;
        html = await ejs.renderFile(templatePath, data.context || {}, {
          async: true,
        });
      }

      if (queue) {
        await queue.add(
          'send',
          { ...data, html },
          {
            attempts: QUEUE_ATTEMPTS,
            backoff: { type: 'exponential', delay: QUEUE_BACKOFF },
          },
        );
      } else {
        await MailService._sendNow({ ...data, html });
      }
    } catch (error) {
      console.error('Error sending email:', error);
      throw new AppException('Failed to send email', 500);
    }
  }

  static async getQueueStatus() {
    try {
      const { queue } = MailService;

      if (!queue) {
        throw new AppException('Queue not available', 503);
      }

      return {
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
        delayed: await queue.getDelayedCount(),
      };
    } catch (error) {
      return { status: false, error: 'Queue not available', data: error };
    }
  }
}
