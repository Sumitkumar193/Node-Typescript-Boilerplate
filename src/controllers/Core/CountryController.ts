import { Request, Response, NextFunction } from 'express';
import { Country, FileType, Prisma } from '@prisma/client';
import prisma from '@database/Prisma';
import ApiException from '@errors/ApiException';
import AuditService from '@services/AuditService';
import { UserWithRoles } from '@interfaces/AppCommonInterface';

export async function createCountry(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    const { name, code, extension, currency } = req.body;

    if (!name || !code || !extension || !currency) {
      throw new ApiException(
        'All fields (name, code, extension, currency) are required.',
        422,
      );
    }

    const existingCountry = await prisma.country.count({
      where: {
        OR: [{ name }, { code }],
      },
    });

    if (existingCountry > 0) {
      throw new ApiException(
        'Country with the same name or code already exists.',
        409,
      );
    }

    const country = await prisma.country.create({
      data: {
        name,
        code,
        extension,
        currency,
      },
    });

    AuditService.logAction(user, 'Country', country.id, 'CREATE', country);

    return res.status(201).json({
      success: true,
      data: country,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateCountry(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    const { code } = req.params;
    const { name, extension, currency } = req.body;

    if (!name || !code || !extension || !currency) {
      throw new ApiException(
        'All fields (name, code, extension, currency) are required.',
        422,
      );
    }

    const country = await prisma.country.update({
      where: { code },
      data: { name, extension, currency },
    });

    AuditService.logAction(user, 'Country', country.id, 'UPDATE', country);

    return res.status(200).json({
      success: true,
      data: country,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCountries(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { page, limit, offset } = res.locals.pagination;
    const { search, sortBy, sortDir } = req.query;

    const where: Prisma.CountryWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
        { currency: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.CountryOrderByWithRelationInput = {};

    if (sortBy && sortDir) {
      orderBy = {
        [sortBy as string]: sortDir as Prisma.SortOrder,
      };
    }

    const countries = await prisma.country.paginate<Country>({
      page,
      limit,
      offset,
      where,
      orderBy,
      select: {
        name: true,
        code: true,
        extension: true,
        currency: true,
      },
    });

    return res.status(200).json(countries);
  } catch (error) {
    return next(error);
  }
}

export async function deleteCountry(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    const { code } = req.params;

    const country = await prisma.country.delete({
      where: { code },
    });

    AuditService.logAction(user, 'Country', country.id, 'DELETE', country);

    return res.status(200).json({
      success: true,
      message: 'Country deleted successfully.',
    });
  } catch (error) {
    return next(error);
  }
}

export async function getFileTypesByCountry(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { code } = req.params;
    const { page, limit, offset } = res.locals.pagination;
    const { search, sortBy, sortDir } = req.query;

    const where: Prisma.FileTypeWhereInput = {
      country: { code },
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.FileTypeOrderByWithRelationInput = {
      isRequired: 'desc',
    };

    if (sortBy && sortDir) {
      orderBy = {
        [sortBy as string]: sortDir as Prisma.SortOrder,
      };
    }

    const fileTypes = await prisma.fileType.paginate<FileType>({
      page,
      limit,
      offset,
      where,
      orderBy,
      select: {
        id: true,
        name: true,
        isRequired: true,
      },
    });

    const withField = fileTypes.data.map((ft) => ({
      ...ft,
      fieldName: ft.name.replace(/\s+/g, '_').toUpperCase(),
    }));

    return res.status(200).json({ ...fileTypes, data: withField });
  } catch (error) {
    return next(error);
  }
}

export async function createFileTypeForCountry(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    const { code } = req.params;
    const { name, isRequired } = req.body;
    if (!name || isRequired === undefined) {
      throw new ApiException(
        'Both name and isRequired fields are required.',
        422,
      );
    }

    const checkFileType = await prisma.fileType.count({
      where: {
        country: { code },
        name,
      },
    });

    if (checkFileType > 0) {
      throw new ApiException(
        'FileType with the same name already exists for this country.',
        409,
      );
    }

    const fileType = await prisma.fileType.create({
      data: {
        name,
        isRequired,
        country: { connect: { code } },
      },
    });

    AuditService.logAction(user, 'FileType', fileType.id, 'CREATE', fileType);

    return res.status(201).json({
      success: true,
      data: fileType,
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateFileTypeForCountry(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    const { code, fileTypeId } = req.params;
    const { name, isRequired } = req.body;

    if (!name || isRequired === undefined) {
      throw new ApiException(
        'Both name and isRequired fields are required.',
        422,
      );
    }

    const country = await prisma.country.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!country) {
      throw new ApiException('Country not found', 404);
    }

    const fileType = await prisma.fileType.update({
      where: {
        id: parseInt(fileTypeId, 10),
        country: { code },
      },
      data: {
        name,
        isRequired,
      },
    });

    AuditService.logAction(user, 'FileType', fileType.id, 'UPDATE', fileType);

    return res.status(200).json({
      success: true,
      data: fileType,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteFileTypeForCountry(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { user } = res.locals as { user: UserWithRoles };
    const { code, fileTypeId } = req.params;

    const fileType = await prisma.fileType.delete({
      where: {
        id: Number(fileTypeId),
        country: { code },
      },
    });

    AuditService.logAction(user, 'FileType', fileType.id, 'DELETE', fileType);

    return res.status(200).json({
      success: true,
      message: 'FileType deleted successfully.',
    });
  } catch (error) {
    return next(error);
  }
}
