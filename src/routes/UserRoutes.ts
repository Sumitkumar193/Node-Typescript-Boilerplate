import { Router } from 'express';
import { getUsers, getUser, disableUser } from '../controllers/UserController';
import Authenticate from '../middlewares/Authenticate';
import HasRole from '../middlewares/HasRole';
import Paginate from '../middlewares/Pagination';

const UserRoutes = Router();

UserRoutes.get('/users', Authenticate, HasRole('Admin'), Paginate, getUsers);
UserRoutes.get('/users/:id', Authenticate, getUser);
UserRoutes.post(
  '/users/:id/disable',
  Authenticate,
  HasRole('Admin'),
  disableUser,
);

export default UserRoutes;
