import { Router } from 'express';
import Authenticate from '@middlewares/Authenticate';
import {
  loginUser,
  createUser,
  getVerifyEmail,
  verifyEmail,
  regenerateVerificationToken,
  logoutUser,
  logoutFromAllDevices,
  forgotPassword,
  getResetPasswordEmail,
  resetPassword,
  refreshToken,
  getSessions,
  revokeSessionHandler,
} from '@controllers/AuthController';
import { getProfile } from '@controllers/UserController';
import LoginRateLimiter from '@middlewares/LoginRateLimiter';
import RefreshRateLimiter from '@middlewares/RefreshRateLimiter';

const AuthRoutes = Router();

AuthRoutes.post('/login', LoginRateLimiter, loginUser);
AuthRoutes.post('/register', createUser);
AuthRoutes.post('/refresh', RefreshRateLimiter, refreshToken);

AuthRoutes.get('/verify/:id', Authenticate, getVerifyEmail);
AuthRoutes.post('/verify/:id', Authenticate, verifyEmail);
AuthRoutes.put('/verify/regenerate', Authenticate, regenerateVerificationToken);

AuthRoutes.post('/forgot-password', forgotPassword);
AuthRoutes.get('/forgot-password/:id', getResetPasswordEmail);
AuthRoutes.post('/forgot-password/:id', resetPassword);

AuthRoutes.get('/me', Authenticate, getProfile);

AuthRoutes.post('/logout', Authenticate, logoutUser);
AuthRoutes.post('/logout/all', Authenticate, logoutFromAllDevices);

AuthRoutes.get('/sessions', Authenticate, getSessions);
AuthRoutes.delete('/sessions/:jti', Authenticate, revokeSessionHandler);

export default AuthRoutes;
