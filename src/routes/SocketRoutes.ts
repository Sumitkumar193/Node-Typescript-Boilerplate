import { Router } from 'express';
import Authenticate from '@middlewares/Authenticate';
import { VerifyCsrf } from '@middlewares/Csrf';
import {
  authPrivate,
  createGroupRoom,
  joinGroupRoom,
} from '@controllers/SocketController';

const SocketRoutes = Router();

SocketRoutes.post('/auth/private', Authenticate, VerifyCsrf, authPrivate);
SocketRoutes.post(
  '/auth/group/create',
  Authenticate,
  VerifyCsrf,
  createGroupRoom,
);
SocketRoutes.post('/auth/group/join', Authenticate, VerifyCsrf, joinGroupRoom);

export default SocketRoutes;
