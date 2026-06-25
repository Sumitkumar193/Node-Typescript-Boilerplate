import { Router } from 'express';
import Authenticate from '@middlewares/Authenticate';
import { AttachCsrf, VerifyCsrf } from '@middlewares/Csrf';
import {
  loginUser,
  createUser,
  getVerifyEmail,
  verifyEmail,
  regenerateVerificationToken,
  logoutUser,
  logoutFromDevice,
  logoutFromAllDevices,
  forgotPassword,
  getResetPasswordEmail,
  resetPassword,
} from '@controllers/AuthController';
import { getProfile } from '@controllers/UserController';
import LoginRateLimiter from '@middlewares/LoginRateLimiter';

const AuthRoutes = Router();

AuthRoutes.get('/csrf-token', AttachCsrf);

AuthRoutes.post('/login', LoginRateLimiter, VerifyCsrf, loginUser);
AuthRoutes.post('/register', VerifyCsrf, createUser);

AuthRoutes.get('/verify/:id', Authenticate, getVerifyEmail);
AuthRoutes.post('/verify/:id', Authenticate, VerifyCsrf, verifyEmail);
AuthRoutes.put('/verify/regenerate', Authenticate, VerifyCsrf, regenerateVerificationToken);

AuthRoutes.post('/forgot-password', VerifyCsrf, forgotPassword);
AuthRoutes.get('/forgot-password/:id', getResetPasswordEmail);
AuthRoutes.post('/forgot-password/:id', VerifyCsrf, resetPassword);

AuthRoutes.get('/me', Authenticate, getProfile);

AuthRoutes.post('/logout', Authenticate, VerifyCsrf, logoutUser);
AuthRoutes.post('/logout/:id', Authenticate, VerifyCsrf, logoutFromDevice);
AuthRoutes.post('/logout/all', Authenticate, VerifyCsrf, logoutFromAllDevices);

export default AuthRoutes;
