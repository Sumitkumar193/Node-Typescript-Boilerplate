import { Router } from 'express';
import {
  getUsers,
  getUser,
  getProfile,
  listTokens,
  disableUser,
} from '../controllers/UserController';
import Authenticate from '../middlewares/Authenticate';
import HasRole from '../middlewares/HasRole';
import Paginate from '../middlewares/Pagination';

const UserRoutes = Router();

UserRoutes.get(
  '/',
  Authenticate,
  HasRole('Admin', 'Moderator'),
  Paginate,
  getUsers,
);
UserRoutes.get('/me', Authenticate, getProfile);
UserRoutes.get('/me/tokens', Authenticate, listTokens);
UserRoutes.get('/:id', Authenticate, getUser);
UserRoutes.post('/:id/disable', Authenticate, HasRole('Admin'), disableUser);

export default UserRoutes;
