import { Router } from 'express';
import { getUsers, getUser, disableUser } from '@controllers/UserController';
import Authenticate from '@middlewares/Authenticate';
import HasRole from '@middlewares/HasRole';
import Paginate from '@middlewares/Pagination';
import { VerifyCsrf } from '@middlewares/Csrf';

const UserRoutes = Router();

UserRoutes.get('/', Authenticate, HasRole('Admin'), Paginate, getUsers);
UserRoutes.get('/:id', Authenticate, getUser);
UserRoutes.post(
  '/:id/disable',
  Authenticate,
  HasRole('Admin'),
  VerifyCsrf,
  disableUser,
);

export default UserRoutes;
