import express, { ErrorRequestHandler } from 'express';
import cors, { CorsOptions } from 'cors';
import RateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import logger from 'morgan';
import helmet from 'helmet';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import csrf from 'csurf';

import Socket from '@services/Socket';
import ApiException from '@errors/ApiException';
import RedisService from '@services/RedisService';
import MailService from '@services/MailService';
import validateOrigin from '@services/CorsService';
import UserRoutes from '@routes/UserRoutes';
import AuthRoutes from '@routes/AuthRoutes';
import CoreRoutes from '@routes/Core/CoreRoutes';
import OrganizationRoutes from '@routes/Core/OrganizationRoutes';
import { AttachCsrf, VerifyCsrf } from '@middlewares/Csrf';

dotenv.config();
RedisService.init();
MailService.init();

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-TOKEN'],
  credentials: true,
};

// ----- Global Middlewares -----
app.use(express.static('public'));
app.use(logger('dev'));
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? 'super_secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite:
        (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') ?? 'lax',
      maxAge: parseInt(process.env.COOKIE_TTL ?? '86400', 10) * 1000,
    },
  }),
);

const csrfProtection = csrf();

const limit = RateLimit({
  windowMs: 60 * 1000,
  limit: parseInt(process.env.RATELIMIT ?? '100', 10),
  message: 'Too many requests from this IP, please try again after a minute',
});

app.use('/api/', limit);

app.use((req, res, next) => {
  if (
    req.method === 'GET' ||
    req.method === 'HEAD' ||
    req.method === 'OPTIONS' ||
    req.path.startsWith('/public') ||
    req.path === '/api/keep-alive'
  ) {
    return next();
  }
  return next();
});

app.get('/api/keep-alive', csrfProtection, AttachCsrf);
app.use('/api/auth', AuthRoutes);
app.use('/api/users', UserRoutes);
app.use('/api/core', CoreRoutes);
app.use('/api/organizations', OrganizationRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fallback: ErrorRequestHandler = (err, _req, res, _next) => {
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

Socket.init(server);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
