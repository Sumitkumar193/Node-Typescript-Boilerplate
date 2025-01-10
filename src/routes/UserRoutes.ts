import { Router } from 'express';
import { Role } from '@prisma/client';
import { getUsers, getUser, disableUser } from '../controllers/UserController';
import Authenticate from '../middlewares/Authenticate';
import HasRole from '../middlewares/HasRole';
import Paginate from '../middlewares/Pagination';

const UserRoutes = Router();

UserRoutes.get('/users', Authenticate, HasRole(Role.ADMIN), Paginate, getUsers);
UserRoutes.get('/users/:id', Authenticate, getUser);
UserRoutes.post(
  '/users/:id/disable',
  Authenticate,
  HasRole(Role.ADMIN),
  disableUser,
);

export default UserRoutes;
