import { Router } from 'express';
import Authenticate from '@middlewares/Authenticate';
import {
  loginUser,
  createInvite,
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
import LoginRateLimiter from '@middlewares/LoginRateLimiter';
import HasRole from '@middlewares/HasRole';
import { OrganizationUploadFields } from '@middlewares/Upload';

const AuthRoutes = Router();

AuthRoutes.post('/login', LoginRateLimiter, loginUser);
AuthRoutes.post('/invite', Authenticate, HasRole('Admin'), createInvite);
AuthRoutes.post('/invite/:code', OrganizationUploadFields, createUser);
AuthRoutes.post('/register', createUser);

AuthRoutes.get('/verify/:id', Authenticate, getVerifyEmail);
AuthRoutes.post('/verify/:id', Authenticate, verifyEmail);
AuthRoutes.put('/verify/regenerate', Authenticate, regenerateVerificationToken);

AuthRoutes.post('/forgot-password', forgotPassword);
AuthRoutes.get('/forgot-password/:id', getResetPasswordEmail);
AuthRoutes.post('/forgot-password/:id', resetPassword);

AuthRoutes.post('/logout', Authenticate, logoutUser);
AuthRoutes.post('/logout/:id', Authenticate, logoutFromDevice);
AuthRoutes.post('/logout/all', Authenticate, logoutFromAllDevices);

export default AuthRoutes;
