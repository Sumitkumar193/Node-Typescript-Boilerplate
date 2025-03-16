import { Router } from 'express';
import {
  getOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
} from '../controllers/OrderController';
import Authenticate from '../middlewares/Authenticate';
import HasRole from '../middlewares/HasRole';
import Paginate from '../middlewares/Pagination';

const OrderRoutes = Router();

OrderRoutes.get('/', Authenticate, Paginate, getOrders);
OrderRoutes.get('/:id', Authenticate, getOrder);
OrderRoutes.post('/', Authenticate, createOrder);
OrderRoutes.put(
  '/:id',
  Authenticate,
  HasRole('Admin', 'Moderator'),
  updateOrder,
);
OrderRoutes.delete('/:id', Authenticate, HasRole('Admin'), deleteOrder);

export default OrderRoutes;
