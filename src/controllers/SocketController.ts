import { NextFunction, Request, Response } from 'express';
import prisma from '@database/Prisma';
import SocketAuthService from '@services/SocketAuthService';
import { UserWithRoles } from '@interfaces/AppCommonInterface';

// POST /api/socket/auth/private
// Issues a HMAC token for a 1-to-1 private room between the caller and targetUserId.
export async function authPrivate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const caller = res.locals.user as UserWithRoles;
    const targetId = parseInt(req.body.targetUserId, 10);
    if (
      !Number.isInteger(targetId) ||
      targetId <= 0 ||
      targetId === caller.id
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid targetUserId' });
    }
    const target = await prisma.user.findUnique({
      where: { id: targetId, disabled: false },
      select: { id: true },
    });
    if (!target)
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });

    const roomId = SocketAuthService.privateRoomId(caller.id, targetId);
    const token = SocketAuthService.generateToken(caller.id, roomId);
    return res.json({ success: true, data: { roomId, token } });
  } catch (err) {
    return next(err);
  }
}

// POST /api/socket/auth/group/create
// Creates a new group room and issues the creator's token.
export function createGroupRoom(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const caller = res.locals.user as UserWithRoles;
    const { roomId, token } = SocketAuthService.createGroupRoom(caller.id);
    return res.json({ success: true, data: { roomId, token } });
  } catch (err) {
    return next(err);
  }
}

// POST /api/socket/auth/group/join
// Issues a join token only if the user was previously authorized via the invite-user socket event.
export function joinGroupRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const caller = res.locals.user as UserWithRoles;
    const { roomId } = req.body;
    if (typeof roomId !== 'string' || !roomId.startsWith('group-')) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid roomId' });
    }
    if (!SocketAuthService.isGroupAuthorized(roomId, caller.id)) {
      return res
        .status(403)
        .json({ success: false, message: 'Not invited to this room' });
    }
    const token = SocketAuthService.generateToken(caller.id, roomId);
    return res.json({ success: true, data: { token } });
  } catch (err) {
    return next(err);
  }
}
