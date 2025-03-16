import { Router } from 'express';
import Authenticate from '../middlewares/Authenticate';
import {
  loginUser,
  createUser,
  logoutUser,
  logoutFromDevice,
  logoutFromAllDevices,
  forgotPassword,
  getResetPasswordEmail,
  resetPassword,
} from '../controllers/AuthController';
import LoginRateLimiter from '../middlewares/LoginRateLimiter';

const AuthRoutes = Router();

AuthRoutes.post('/login', LoginRateLimiter, loginUser);
AuthRoutes.post('/register', createUser);
AuthRoutes.post('/forgot-password', forgotPassword);
AuthRoutes.get('/forgot-password/:id', getResetPasswordEmail);
AuthRoutes.post('/forgot-password/:id', resetPassword);
AuthRoutes.post('/logout', Authenticate, logoutUser);
AuthRoutes.post('/logout/:id', Authenticate, logoutFromDevice);
AuthRoutes.post('/logout/all', Authenticate, logoutFromAllDevices);

export default AuthRoutes;
