import { Router } from 'express';
import AdminJobController from '@controllers/AdminJobController';
import Authenticate from '@middlewares/Authenticate';
import HasRole from '@middlewares/HasRole';

const router = Router();

// All admin job routes require authentication and admin role
router.use(Authenticate);
router.use(HasRole('Admin'));

// Job log routes
const jobLogRoutes = Router();
jobLogRoutes.get('/logs', AdminJobController.getJobLogs);
jobLogRoutes.get('/logs/:id', AdminJobController.getJobLogById);
jobLogRoutes.post('/logs/:id/replay', AdminJobController.replayJob);
jobLogRoutes.post('/:queueName/:jobId/retry', AdminJobController.retryJob);
jobLogRoutes.get('/queues/:name/status', AdminJobController.getQueueStatus);

// Mount the job log routes under /admin
router.use('/jobs', jobLogRoutes);

export default router;
