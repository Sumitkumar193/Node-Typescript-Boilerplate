import express, { ErrorRequestHandler } from 'express';
import cors, { CorsOptions } from 'cors';
import RateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import logger from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import RedisClient from './cache/Redis';
import MailService from './services/MailService';
import Socket from './services/Socket';
import { AttachCsrf, VerifyCsrf } from './middlewares/Csrf';
import Seed from './controllers/Seeder';
import UserRoutes from './routes/UserRoutes';
import AuthRoutes from './routes/AuthRoutes';

dotenv.config();
RedisClient.init();
MailService.init();

const app = express();

const corsOptions: CorsOptions = {
  origin: process.env.FRONTEND_URL ?? '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-TOKEN'],
  credentials: true,
};

app.use(logger('dev'));
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());

const limit = RateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  message: 'Too many requests from this IP, please try again after a minute',
});

app.use(cookieParser());
app.use('/api', VerifyCsrf);
app.use('/api', limit);
app.get('/api/keep-alive', AttachCsrf);
app.get('/api/seed/:secret', Seed);
app.use('/api/users', UserRoutes);
app.use('/api/auth', AuthRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fallback: ErrorRequestHandler = (err, _req, res, _next) => {
  res.status(500).json({ success: false, message: err.message });
};

app.use(fallback);

const PORT = process.env.PORT ?? 3005;

const server = createServer(app);

Socket.init(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
