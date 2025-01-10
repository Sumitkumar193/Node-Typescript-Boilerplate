import { Router } from 'express';
import Authenticate from '../middlewares/Authenticate';
import {
  loginUser,
  createUser,
  logoutUser,
  logoutFromAllDevices,
} from '../controllers/AuthController';

const AuthRoutes = Router();

AuthRoutes.post('/login', loginUser);
AuthRoutes.post('/register', createUser);
AuthRoutes.post('/logout', Authenticate, logoutUser);
AuthRoutes.post('/logout/all', Authenticate, logoutFromAllDevices);

export default AuthRoutes;
