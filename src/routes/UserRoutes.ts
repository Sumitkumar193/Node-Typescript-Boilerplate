import { Router } from 'express';
import { getUsers } from '../controllers/UserController';
import Authenticate from '../middlewares/Authenticate';
import HasRole from '../middlewares/HasRole';
import { Role } from '@prisma/client';
import Paginate from '../middlewares/Pagination';

const UserRoutes = Router();

UserRoutes.get('/users', Authenticate, HasRole(Role.ADMIN), Paginate, getUsers);

export default UserRoutes;
