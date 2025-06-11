import express, { ErrorRequestHandler } from 'express';
import cors, { CorsOptions } from 'cors';
import RateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import logger from 'morgan';
import helmet from 'helmet';
import Socket from './services/Socket';
import ApiException from './errors/ApiException';
import RedisService from './services/RedisService';
import MailService from './services/MailService';
import validateOrigin from './services/CorsService';
import UserRoutes from './routes/UserRoutes';
import AuthRoutes from './routes/AuthRoutes';
import { AttachCsrf, VerifyCsrf } from './middlewares/Csrf';

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

app.use(express.static('public'));
app.use(logger('dev'));
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());

const limit = RateLimit({
  windowMs: 60 * 1000,
  limit: parseInt(process.env.RATELIMIT ?? '100', 10),
  message: 'Too many requests from this IP, please try again after a minute',
});

app.use('/api', VerifyCsrf);
app.use('/api/', limit);
app.get('/api/keep-alive', AttachCsrf);
app.use('/api/users', UserRoutes);
app.use('/api/auth', AuthRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fallback: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiException) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
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
