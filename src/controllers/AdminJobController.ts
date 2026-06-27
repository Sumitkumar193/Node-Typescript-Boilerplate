import { Request, Response } from 'express';
import BullMQService from '@services/BullMQService';
import { JobStatus, JOB_STATUSES } from '@interfaces/JobLogInterface';

class AdminJobController {
  static async getJobLogs(req: Request, res: Response) {
    try {
      const { queue, status, limit, offset } = req.query;

      const filters: {
        queue?: string;
        status?: JobStatus;
        limit?: number;
        offset?: number;
      } = {};
      if (queue && typeof queue === 'string') filters.queue = queue;
      if (
        status &&
        typeof status === 'string' &&
        (JOB_STATUSES as readonly string[]).includes(status)
      ) {
        filters.status = status as JobStatus;
      }

      if (limit && typeof limit === 'string') {
        const limitNum = Number(limit);
        if (Number.isNaN(limitNum) || limitNum <= 0) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid limit' });
        }
        filters.limit = Math.min(limitNum, 100);
      }

      if (offset && typeof offset === 'string') {
        const offsetNum = Number(offset);
        if (Number.isNaN(offsetNum) || offsetNum < 0) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid offset' });
        }
        filters.offset = offsetNum;
      }

      const jobLogs = await BullMQService.getJobLogs(filters);
      return res.json({ success: true, data: jobLogs });
    } catch {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to retrieve job logs' });
    }
  }

  static async getJobLogById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const jobLogId = Number(id);

      if (Number.isNaN(jobLogId)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid job log ID' });
      }

      const jobLog = await BullMQService.getJobLogById(jobLogId);
      if (!jobLog) {
        return res
          .status(404)
          .json({ success: false, message: 'Job log not found' });
      }

      return res.json({ success: true, data: jobLog });
    } catch {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to retrieve job log' });
    }
  }

  static async replayJob(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const jobLogId = Number(id);

      if (Number.isNaN(jobLogId)) {
        return res
          .status(400)
          .json({ success: false, message: 'Invalid job log ID' });
      }

      const newJobId = await BullMQService.replayJobById(jobLogId);
      if (!newJobId) {
        return res.status(400).json({
          success: false,
          message:
            'Failed to replay job. It may not be in a failed state or may not exist.',
        });
      }

      return res.json({
        success: true,
        message: 'Job replayed successfully',
        data: { newJobId },
      });
    } catch {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to replay job' });
    }
  }

  static async retryJob(req: Request, res: Response) {
    try {
      const { queueName, jobId } = req.params;
      const success = await BullMQService.retryJob(queueName, jobId);

      if (!success) {
        return res.status(400).json({
          success: false,
          message:
            'Failed to retry job. It may be a completed job or not exist.',
        });
      }

      return res.json({
        success: true,
        message: 'Job retry initiated successfully',
      });
    } catch {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to retry job' });
    }
  }

  static async getQueueStatus(req: Request, res: Response) {
    try {
      const { name } = req.params;
      const status = BullMQService.getQueueStatus(name);

      if (!status) {
        return res
          .status(404)
          .json({ success: false, message: 'Queue not found' });
      }

      return res.json({ success: true, data: status });
    } catch {
      return res
        .status(500)
        .json({ success: false, message: 'Failed to retrieve queue status' });
    }
  }
}

export default AdminJobController;
