import crypto, { randomUUID } from 'node:crypto';

const SECRET = process.env.SOCKET_SECRET ?? process.env.JWT_SECRET ?? '';

function hmac(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

// Tracks which users are authorized to request a group-room join token.
// Written by the invite-user socket handler; read by the HTTP join endpoint.
const groupAuthorized: Map<string, Set<number>> = new Map();

export default class SocketAuthService {
  static generateToken(userId: number, roomId: string): string {
    return hmac(`${userId}:${roomId}`);
  }

  static verifyToken(userId: number, roomId: string, token: string): boolean {
    try {
      const expected = Buffer.from(hmac(`${userId}:${roomId}`), 'hex');
      const provided = Buffer.from(token, 'hex');
      if (provided.length !== expected.length) return false;
      return crypto.timingSafeEqual(provided, expected);
    } catch {
      return false;
    }
  }

  // Canonical 1-to-1 room ID — same for both participants regardless of call order.
  static privateRoomId(userIdA: number, userIdB: number): string {
    const [a, b] = [Math.min(userIdA, userIdB), Math.max(userIdA, userIdB)];
    return `private-${a}-${b}`;
  }

  // Creates a server-owned group room and returns the creator's token.
  static createGroupRoom(creatorId: number): { roomId: string; token: string } {
    const roomId = `group-${randomUUID()}`;
    groupAuthorized.set(roomId, new Set([creatorId]));
    return { roomId, token: this.generateToken(creatorId, roomId) };
  }

  // Called by the invite-user socket handler to allow an invitee to request a token.
  // Returns false if the room was never created via createGroupRoom (rejects phantom room IDs).
  static authorizeGroupMember(roomId: string, userId: number): boolean {
    const members = groupAuthorized.get(roomId);
    if (!members) return false;
    members.add(userId);
    return true;
  }

  static isGroupAuthorized(roomId: string, userId: number): boolean {
    return groupAuthorized.get(roomId)?.has(userId) ?? false;
  }
}
