import express, { ErrorRequestHandler } from 'express';
import cors, { CorsOptions } from 'cors';
import RateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import logger from 'morgan';
import helmet from 'helmet';
import Sentry from '@sentry/node';

import Socket from '@services/Socket';
import ApiException from '@errors/ApiException';
import RedisService from '@services/RedisService';
import MailService from '@services/MailService';
import BullMQService from '@services/BullMQService';
import validateOrigin from '@services/CorsService';
import UserRoutes from '@routes/UserRoutes';
import AuthRoutes from '@routes/AuthRoutes';
import SocketUWS from './services/uSocket';

dotenv.config();
RedisService.init();
MailService.init();

const dsn = process.env.SENTRY_DSN;
if (dsn && dsn.length > 0) {
  Sentry.init({
    dsn,
    tracesSampleRate: 1.0,
    sendDefaultPii: true,
    environment: process.env.NODE_ENV,
    serverName: process.env.APP_NAME || 'Node-Typescript-Boilerplate',
    includeServerName: true,
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
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

// ----- Global Middlewares -----
app.use(express.static('public'));
app.use('/storage', express.static('storage'));
app.use(logger('dev'));
app.use(cors(corsOptions));
app.use(helmet());
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
