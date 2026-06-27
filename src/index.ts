import express, { ErrorRequestHandler } from 'express';
import cors, { CorsOptions } from 'cors';
import RateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import logger from 'morgan';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import Sentry from '@sentry/node';

import Socket from '@services/Socket';
import ApiException from '@errors/ApiException';
import RedisService from '@services/RedisService';
import MailService from '@services/MailService';
import BullMQService from '@services/BullMQService';
import RefreshTokenService from '@services/RefreshTokenService';
import validateOrigin from '@services/CorsService';
import UserRoutes from '@routes/UserRoutes';
import AuthRoutes from '@routes/AuthRoutes';
import SocketRoutes from '@routes/SocketRoutes';
import AdminJobRoutes from '@routes/AdminJobRoutes';
import SocketUWS from './services/uSocket';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET env var is required');
}

if (!process.env.JOB_ENCRYPTION_KEY) {
  throw new Error('JOB_ENCRYPTION_KEY env var is required — generate one with: openssl rand -hex 32');
}

RedisService.init();
MailService.init();

RefreshTokenService.cleanup().catch(console.error);
setInterval(
  () => RefreshTokenService.cleanup().catch(console.error),
  24 * 60 * 60 * 1000,
).unref();

const dsn = process.env.SENTRY_DSN;
if (dsn && dsn.length > 0) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    environment: process.env.NODE_ENV,
    serverName: process.env.APP_NAME || 'Node-Typescript-Boilerplate',
    includeServerName: true,
    beforeSend(event) {
      const data = event.extra?.data as Record<string, unknown> | undefined;
      if (data) {
        const SCRUB = [
          'password',
          'confirmPassword',
          'currentPassword',
          'code',
          'token',
          'email',
          'name',
        ];
        const body = data.body as Record<string, unknown> | undefined;
        if (body) {
          const scrubbed = { ...body };
          SCRUB.forEach((k) => delete scrubbed[k]);
          data.body = scrubbed;
        }
        // don't forward query params or user object — may contain tokens/PII
        delete data.query;
      }
      const safeExtra = {
        ...(event.extra as Record<string, unknown> | undefined),
      };
      delete safeExtra.user;
      return { ...event, extra: safeExtra };
    },
  });
}

const app = express();

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || validateOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-xsrf-token'],
  credentials: true,
};

// ----- Global Middlewares -----
app.use(express.static('public'));
// /storage is NOT served statically — private files must go through an authenticated controller.
app.use(logger('dev'));
app.use(cors(corsOptions));
app.use(helmet());
app.use(cookieParser());
app.use(express.json());

const limit = RateLimit({
  windowMs: 60 * 1000,
  limit: parseInt(process.env.RATELIMIT ?? '100', 10),
  message: 'Too many requests from this IP, please try again after a minute',
});

app.use('/api/', limit);

app.get('/api/keep-alive', (req, res) =>
  res.status(200).json({ success: true, message: 'Keep alive' }),
);
app.use('/api/users', UserRoutes);
app.use('/api/auth', AuthRoutes);
app.use('/api/socket', SocketRoutes);
app.use('/api/admin', AdminJobRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fallback: ErrorRequestHandler = (err, req, res, _next) => {
  if (Sentry.isInitialized()) {
    Sentry.captureException(
      {
        ...err,
        message: `${process.env.APP_NAME || 'Node-Typescript-Boilerplate'} : ${err.message}`,
      },
      {
        extra: {
          user: res.locals.user,
          data: {
            body: req.body,
            params: req.params,
            query: req.query,
          },
        },
      },
    );
  }

  if (err instanceof ApiException) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      data: err.data,
    });
  }

  // Optionally log the error here
  return res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Unknown error',
  });
};

app.use(fallback);

const PORT = process.env.PORT ?? 3005;

const server = createServer(app);

if (String(process.env.SOCKET_DRIVER).toLowerCase() === 'uwebsocket') {
  SocketUWS.init();
} else {
  Socket.init(server);
}

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await BullMQService.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await BullMQService.shutdown();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
