import { Router } from 'express';
import Authenticate from '@middlewares/Authenticate';
import {
  authPrivate,
  createGroupRoom,
  joinGroupRoom,
} from '@controllers/SocketController';

const SocketRoutes = Router();

SocketRoutes.post('/auth/private', Authenticate, authPrivate);
SocketRoutes.post('/auth/group/create', Authenticate, createGroupRoom);
SocketRoutes.post('/auth/group/join', Authenticate, joinGroupRoom);

export default SocketRoutes;
