import { Request, Response, NextFunction } from 'express';
import ApiException from '@errors/ApiException';
import prisma from '@database/Prisma';
import { UserWithRoles } from '@interfaces/AppCommonInterface';
import {
  Organization,
  OrganizationVerificationStatus,
  Prisma,
} from '@prisma/client';
import AuditService from '@services/AuditService';

export async function listOrganizations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    const { page, limit, offset } = res.locals.pagination;
    const { search, sortBy, sortDir } = req.query;

    const where: Prisma.OrganizationWhereInput = {};

    // If user is not an Admin, restrict to organizations they are associated with
    if (user.Role.name !== 'Admin') {
      where.userId = user.id;
    }

    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }

    let orderBy: Prisma.OrganizationOrderByWithRelationInput = {};
    if (sortBy && sortDir) {
      orderBy = {
        [sortBy as string]: sortDir as Prisma.SortOrder,
      };
    }

    const organizations = await prisma.organization.paginate<Organization>({
      page,
      limit,
      offset,
      where,
      orderBy,
      select: {
        id: true,
        name: true,
        address: true,
        placeId: true,
        latitude: true,
        longitude: true,
        type: true,
      },
    });

    return res.status(200).json(organizations);
  } catch (error) {
    return next(error);
  }
}

export async function getOrganizationDetails(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { orgId } = req.params;

    if (Number.isNaN(Number(orgId))) {
      throw new ApiException('Organization ID is required', 400);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: Number(orgId) },
      include: {
        User: true,
        OrganizationDocuments: {
          select: {
            id: true,
            isVerified: true,
            FileType: {
              select: {
                id: true,
                name: true,
                isRequired: true,
              },
            },
          },
        },
        OrganizationCountry: true,
      },
    });

    if (!organization) {
      return next(new ApiException('Organization not found', 404));
    }

    return res.status(200).json({
      success: true,
      data: organization,
    });
  } catch (error) {
    return next(error);
  }
}

export async function verifyFileForOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    const { orgId, fileId } = req.params;
    const { isVerified } = req.body;

    if (isVerified === undefined) {
      throw new ApiException('isVerified field is required', 422);
    }

    await prisma.organizationDocuments.update({
      where: {
        id: Number(fileId),
        organizationId: Number(orgId),
        isVerified: false,
      },
      data: {
        isVerified,
      },
    });

    AuditService.logAction(user, 'OrganizationDocuments', fileId, 'UPDATE', {
      isVerified,
    });

    const files = await prisma.organizationDocuments.count({
      where: {
        organizationId: Number(orgId),
        isVerified: false,
      },
    });

    if (files === 0) {
      const updateOrg = await prisma.organization.update({
        where: {
          id: Number(orgId),
        },
        data: {
          verificationStatus: OrganizationVerificationStatus.FINAL_REVIEW,
        },
      });

      AuditService.logAction(user, 'Organization', orgId, 'UPDATE', updateOrg);
    }
    return res.status(200).json({
      success: true,
      message: 'File verification status updated successfully',
    });
  } catch (error) {
    return next(error);
  }
}

export async function verifyOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    const { orgId } = req.params;
    const { isVerified }: { isVerified: boolean } = req.body;

    const organization = await prisma.organization.findUnique({
      where: { id: Number(orgId) },
    });

    if (!organization) {
      throw new ApiException('Organization not found', 404);
    }

    const updatedOrg = await prisma.organization.update({
      where: { id: Number(orgId) },
      data: {
        verificationStatus: isVerified ? 'VERIFIED' : 'REJECTED',
        OrganizationDocuments: {
          updateMany: {
            where: { isVerified: false },
            data: { isVerified },
          },
        },
      },
      include: {
        User: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    AuditService.logAction(user, 'Organization', orgId, 'UPDATE', updatedOrg);

    return res.status(200).json({
      success: true,
      message: `Organization has been ${isVerified ? 'verified' : 'rejected'} successfully`,
      data: updatedOrg,
    });
  } catch (error) {
    return next(error);
  }
}

export async function assignUserToOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    const { orgId } = req.params;
    const { userId, role } = req.body;

    if (!userId || !role) {
      throw new ApiException('userId and role are required', 422);
    }

    const organization = await prisma.organization.findUnique({
      where: { id: Number(orgId) },
    });

    if (!organization) {
      return next(new ApiException('Organization not found', 404));
    }

    const userToAssign = await prisma.user.findUnique({
      where: { id: Number(userId) },
    });

    if (!userToAssign) {
      return next(new ApiException('User to assign not found', 404));
    }

    const existingAssignment = await prisma.organizationMember.findFirst({
      where: {
        userId: Number(userId),
        organizationId: Number(orgId),
      },
    });

    if (existingAssignment) {
      throw new ApiException(
        'User is already assigned to this organization',
        400,
      );
    }

    const newAssignment = await prisma.organizationMember.upsert({
      where: {
        userId: Number(userId),
        organizationId: Number(orgId),
      },
      update: { role },
      create: {
        userId: Number(userId),
        organizationId: Number(orgId),
        role,
      },
    });

    AuditService.logAction(
      user,
      'OrganizationMember',
      newAssignment.id,
      'CREATE',
      newAssignment,
    );

    return res.status(201).json({
      success: true,
      message: 'User assigned to organization successfully',
      data: newAssignment,
    });
  } catch (error) {
    return next(error);
  }
}
