import { Router } from 'express';
import Authenticate from '@middlewares/Authenticate';
import HasRole from '@middlewares/HasRole';
import {
  assignUserToOrganization,
  getOrganizationDetails,
  listOrganizations,
  verifyFileForOrganization,
  verifyOrganization,
} from '@controllers/OrganizationController';
import Paginate from '@middlewares/Pagination';

const OrganizationRoutes = Router();

OrganizationRoutes.get('/', Authenticate, Paginate, listOrganizations);

OrganizationRoutes.post(
  '/:orgId/assign',
  Authenticate,
  assignUserToOrganization,
);

OrganizationRoutes.get(
  '/:orgId',
  Authenticate,
  getOrganizationDetails,
);

OrganizationRoutes.post(
  '/:orgId/file/:fileId/verify',
  Authenticate,
  HasRole('Admin'),
  verifyFileForOrganization,
);

OrganizationRoutes.post(
  '/:orgId/verify',
  Authenticate,
  HasRole('Admin'),
  verifyOrganization,
);

export default OrganizationRoutes;