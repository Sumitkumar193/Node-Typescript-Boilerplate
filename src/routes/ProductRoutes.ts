import { Router } from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  updateProductStock,
  deleteProduct,
} from '../controllers/ProductController';
import Authenticate from '../middlewares/Authenticate';
import HasRole from '../middlewares/HasRole';
import Paginate from '../middlewares/Pagination';

const ProductRoutes = Router();

ProductRoutes.get('/', Paginate, getProducts);
ProductRoutes.get('/:id', getProduct);
ProductRoutes.post('/', Authenticate, HasRole('Admin'), createProduct);
ProductRoutes.put('/:id', Authenticate, HasRole('Admin'), updateProduct);
ProductRoutes.patch(
  '/:id/stock',
  Authenticate,
  HasRole('Admin', 'Moderator'),
  updateProductStock,
);
ProductRoutes.delete('/:id', Authenticate, HasRole('Admin'), deleteProduct);

export default ProductRoutes;
