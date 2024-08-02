import { Router } from 'express';
import { createUser, getUsers } from '../controllers/UserController';
import Authenticate from '../middlewares/Authenticate';
import HasRole from '../middlewares/HasRole';
import { IUserRoleEnum } from '../interfaces/UserInterface';
import Paginate from '../middlewares/Pagination';

const UserRoutes = Router();

UserRoutes.get('/users', Authenticate, Paginate, getUsers);
UserRoutes.post('/users', Authenticate, HasRole(IUserRoleEnum.Admin), createUser);

export default UserRoutes;
