import { Request, Response, NextFunction } from 'express';
import {
  OrganizationMemberRole,
  OrganizationVerificationStatus,
  Prisma,
} from '@prisma/client';
import ApiException from '@errors/ApiException';
import prisma from '@database/Prisma';
import { UserWithRoles } from '@interfaces/AppCommonInterface';

const UNAUTHORIZED_MESSAGE = 'Unauthorized';
const FORBIDDEN_MESSAGE = 'Access Denied';

const Ownership =
  (
    Model: Prisma.ModelName,
    Action?: 'Read' | 'Write' | 'Delete' | 'Update',
    Param?: string,
  ) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = res.locals as { user: UserWithRoles };

      if (!user) {
        throw new ApiException(UNAUTHORIZED_MESSAGE, 401);
      }

      const isAdmin = user.Role.name === 'Admin';

      if (!Param) {
        throw new ApiException(
          'Param is required for Ownership middleware.',
          500,
        );
      }

      const resourceId = req.params[Param];

      switch (Model) {
        case 'User':
          if (!isAdmin && user.id !== parseInt(resourceId, 10)) {
            throw new ApiException(FORBIDDEN_MESSAGE, 403);
          }

          const requestedUser = await prisma.user.findUnique({
            where: { id: parseInt(resourceId, 10) },
            include: {
                Role: true,
                Organization: true,
                OrganizationMember: true,
            }
          });

          res.locals.user = requestedUser;
          break;
        case 'Organization': {
          const organization = await prisma.organization.findUnique({
            where: {
              id: parseInt(resourceId, 10),
              verificationStatus: OrganizationVerificationStatus.VERIFIED,
            },
          });

          if (!organization) {
            throw new ApiException(FORBIDDEN_MESSAGE, 403);
          }

          break;
        }
        case 'OrganizationMember': {
          const organization = await prisma.organizationMember.findFirst({
            where: {
              organizationId: parseInt(resourceId, 10),
              userId: user.id,
              role: {
                in: [
                  OrganizationMemberRole.ADMIN,
                  OrganizationMemberRole.OWNER,
                ],
              },
            },
            include: {
              Organization: true,
            },
          });

          if (!organization) {
            throw new ApiException(FORBIDDEN_MESSAGE, 403);
          }

          if (
            organization.Organization.verificationStatus !==
            OrganizationVerificationStatus.VERIFIED
          ) {
            throw new ApiException('Organization Verification is Pending', 403);
          }

          break;
        }
        default:
          throw new ApiException('Model not supported for Ownership.', 400);
      }

      return next();
    } catch (error) {
      console.log(`Model: ${Model}, Action: ${Action}, Param: ${Param}`, error);
      return next(error);
    }
  };
export default Ownership;
