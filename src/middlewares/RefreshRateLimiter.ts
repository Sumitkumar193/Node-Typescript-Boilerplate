import RateLimit from 'express-rate-limit';

const RefreshRateLimiter = RateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
});

export default RefreshRateLimiter;
