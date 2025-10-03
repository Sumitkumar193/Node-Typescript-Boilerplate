import prisma from '@database/Prisma';
import { UserWithRoles } from '@interfaces/AppCommonInterface';
import { Prisma } from '@prisma/client';

class AuditService {
  static async logAction(
    user: UserWithRoles,
    entity: Prisma.ModelName,
    entityId: string | number,
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'OTHER',
    changes: Record<string, unknown> = {},
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          changes,
          entity,
          entityId: String(entityId),
          action,
          User: {
            connect: { id: user.id },
          },
        },
      });
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  }
}

export default AuditService;
