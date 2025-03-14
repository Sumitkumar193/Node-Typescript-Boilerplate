import { Router } from 'express';
import Authenticate from '../middlewares/Authenticate';
import {
  loginUser,
  createUser,
  logoutUser,
  logoutFromDevice,
  logoutFromAllDevices,
} from '../controllers/AuthController';

const AuthRoutes = Router();

AuthRoutes.post('/login', loginUser);
AuthRoutes.post('/register', createUser);
AuthRoutes.post('/logout', Authenticate, logoutUser);
AuthRoutes.post('/logout/:id', Authenticate, logoutFromDevice);
AuthRoutes.post('/logout/all', Authenticate, logoutFromAllDevices);

export default AuthRoutes;
