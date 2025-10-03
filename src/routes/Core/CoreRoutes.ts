import { Router } from 'express';
import Authenticate from '@middlewares/Authenticate';
import HasRole from '@middlewares/HasRole';
import Paginate from '@middlewares/Pagination';
import {
  getCountries,
  createCountry,
  updateCountry,
  deleteCountry,
  createFileTypeForCountry,
  getFileTypesByCountry,
  updateFileTypeForCountry,
  deleteFileTypeForCountry,
} from '@controllers/Core/CountryController';

const CoreRoutes = Router();

CoreRoutes.get('/countries', Paginate, getCountries);

CoreRoutes.post('/countries', Authenticate, HasRole('Admin'), createCountry);

CoreRoutes.put(
  '/countries/:code',
  Authenticate,
  HasRole('Admin'),
  updateCountry,
);

CoreRoutes.delete(
  '/countries/:code',
  Authenticate,
  HasRole('Admin'),
  deleteCountry,
);

// FileType Routes
CoreRoutes.get('/countries/:code/filetypes', Paginate, getFileTypesByCountry);

CoreRoutes.post(
  '/countries/:code/filetypes',
  Authenticate,
  HasRole('Admin'),
  createFileTypeForCountry,
);

CoreRoutes.put(
  '/countries/:code/filetypes/:fileTypeId',
  Authenticate,
  HasRole('Admin'),
  updateFileTypeForCountry,
);

CoreRoutes.delete(
  '/countries/:code/filetypes/:fileTypeId',
  Authenticate,
  HasRole('Admin'),
  deleteFileTypeForCountry,
);

export default CoreRoutes;