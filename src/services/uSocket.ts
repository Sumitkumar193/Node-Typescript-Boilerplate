import uWS from 'uWebSockets.js';
import { getUserFromToken } from '@services/TokenService';
import prisma from '@database/Prisma';
import validateOrigin from '@services/CorsService';
import SocketAuthService from '@services/SocketAuthService';
import { User, Role } from '@prisma/client';
import { UserWithRoles } from '@interfaces/AppCommonInterface';

/**
 * @class SocketUWS
 * @description WebSocket class using uWebSockets.js with optional authentication
 */
class SocketUWS {
  private static app: uWS.TemplatedApp;

  // Track all sockets (both authenticated and unauthenticated)
  private static allSockets: Set<uWS.WebSocket<unknown>> = new Set();

  // Track authenticated users
  private static userSocketMap: Map<number, Set<uWS.WebSocket<unknown>>> =
    new Map();

  private static wsUserMap: Map<uWS.WebSocket<unknown>, number> = new Map();

  // Track socket metadata
  private static wsMetadataMap: Map<
    uWS.WebSocket<unknown>,
    { id: string; joinedAt: Date }
  > = new Map();

  static init() {
    this.app = uWS.App({
      // You can add SSL options here if needed
    });

    this.app.ws('/*', {
      /* Handshake validation */
      upgrade: (res, req, context) => {
        const origin = req.getHeader('origin');
        if (origin && !validateOrigin(origin)) {
          res.writeStatus('403 Forbidden').end();
          return;
        }

        // Extract potential token from cookie
        const cookie = req.getHeader('cookie');
        const accessToken = cookie?.split('accessToken=')[1]?.split(';')[0];

        res.upgrade(
          { accessToken }, // Pass token in user data
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          context,
        );
      },

      open: async (ws: uWS.WebSocket<unknown>) => {
        const socketId = this.generateSocketId();
        const metadata = { id: socketId, joinedAt: new Date() };

        // Add to all sockets (public room equivalent)
        this.allSockets.add(ws);
        this.wsMetadataMap.set(ws, metadata);
        console.log('Socket connected', socketId);

        // Try to authenticate from cookie if available
        const userData = ws.getUserData() as { accessToken?: string };
        if (userData?.accessToken) {
          try {
            await this.handleAuth(ws, userData.accessToken);
          } catch (error) {
            console.error('Auto-authentication failed:', error);
            // Don't close connection, just continue as unauthenticated
          }
        }
      },

      message: async (ws: uWS.WebSocket<unknown>, message, isBinary) => {
        try {
          if (isBinary) {
            console.warn('Binary messages are not supported');
            return;
          }

          const str = Buffer.from(message).toString();
          const data = JSON.parse(str);

          await this.handleMessage(ws, data);
        } catch (err) {
          console.error('Message handling error:', err);
          this.sendMessage(ws, {
            event: 'error',
            message: 'Invalid message format',
          });
        }
      },

      close: (ws: uWS.WebSocket<unknown>) => {
        const metadata = this.wsMetadataMap.get(ws);
        console.log('Socket disconnected', metadata?.id);
        this.cleanupConnection(ws);
      },
    });

    this.app.listen(
      parseInt(process.env.SOCKET_PORT as string, 10),
      (token) => {
        if (token) {
          console.log(
            `uWebSockets.js server started on port ${process.env.SOCKET_PORT}`,
          );
        } else {
          console.error('Failed to start uWebSockets.js server');
        }
      },
    );
  }

  private static async handleMessage<T>(
    ws: uWS.WebSocket<unknown>,
    data: T & { event: string; accessToken?: string },
  ) {
    switch (data.event) {
      case 'identify':
        await this.handleIdentify(ws, data.accessToken);
        break;

      case 'join-private-room': {
        const { roomId, token } = data as {
          event: string;
          roomId?: string;
          token?: string;
        };
        const userId = this.wsUserMap.get(ws);
        if (!userId) {
          this.sendMessage(ws, { event: 'auth-required' });
          break;
        }
        if (
          typeof roomId !== 'string' ||
          typeof token !== 'string' ||
          !SocketAuthService.verifyToken(userId, roomId, token)
        ) {
          this.sendMessage(ws, {
            event: 'join-room-denied',
            roomId,
            reason: 'Invalid token',
          });
          break;
        }
        ws.subscribe(roomId);
        this.app.publish(
          roomId,
          JSON.stringify({ event: 'user-joined' }),
          false,
          true,
        );
        break;
      }

      case 'invite-user': {
        const { roomId, userId: targetUserId } = data as {
          event: string;
          roomId?: string;
          userId?: unknown;
        };
        const callerId = this.wsUserMap.get(ws);
        if (!callerId) {
          this.sendMessage(ws, { event: 'auth-required' });
          break;
        }
        if (typeof roomId !== 'string' || !roomId.startsWith('group-')) break;
        if (!SocketAuthService.isGroupAuthorized(roomId, callerId)) break;
        const targetId = parseInt(targetUserId as string, 10);
        if (!Number.isInteger(targetId) || targetId <= 0) break;
        const targetExists = await prisma.user.findUnique({
          where: { id: targetId, disabled: false },
          select: { id: true },
        });
        if (!targetExists) break;
        SocketAuthService.authorizeGroupMember(roomId, targetId);
        this.userSocketMap.get(targetId)?.forEach((targetWs) => {
          this.sendMessage(targetWs, { event: 'invited-to-room', roomId });
        });
        break;
      }

      default:
        console.log('Unhandled event:', data.event);
    }
  }

  private static async handleIdentify(
    ws: uWS.WebSocket<unknown>,
    accessToken?: string,
  ) {
    try {
      const user = await this.handleAuth(ws, accessToken);
      if (user) {
        this.sendMessage(ws, {
          event: 'identified',
          name: user.name,
          email: user.email,
        });
      } else {
        this.sendMessage(ws, {
          event: 'auth_failed',
          message: 'Authentication failed',
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      this.sendMessage(ws, {
        event: 'error',
        message: 'Authentication error',
      });
    }
  }

  private static async handleAuth(
    ws: uWS.WebSocket<unknown>,
    accessToken?: string,
  ): Promise<UserWithRoles | null> {
    if (!accessToken) return null;

    try {
      const user = await getUserFromToken(accessToken);
      if (user) {
        this.addUserSocket(user, ws);
        return user;
      }
    } catch (error) {
      console.error('Token validation error:', error);
      throw error;
    }

    return null;
  }

  private static addUserSocket(
    user: UserWithRoles,
    ws: uWS.WebSocket<unknown>,
  ) {
    const userId = user.id;

    // Remove from previous user if already mapped
    const existingUserId = this.wsUserMap.get(ws);
    if (existingUserId && existingUserId !== userId) {
      this.userSocketMap.get(existingUserId)?.delete(ws);
      if (this.userSocketMap.get(existingUserId)?.size === 0) {
        this.userSocketMap.delete(existingUserId);
      }
    }

    if (!this.userSocketMap.has(userId)) {
      this.userSocketMap.set(userId, new Set());
    }
    this.userSocketMap.get(userId)?.add(ws);
    this.wsUserMap.set(ws, userId);
  }

  private static cleanupConnection(ws: uWS.WebSocket<unknown>) {
    // Remove from all tracking maps
    this.allSockets.delete(ws);
    this.wsMetadataMap.delete(ws);

    // Remove from user-specific tracking
    const userId = this.wsUserMap.get(ws);
    if (userId) {
      const userSockets = this.userSocketMap.get(userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          this.userSocketMap.delete(userId);
        }
      }
      this.wsUserMap.delete(ws);
    }
  }

  private static sendMessage<T>(
    ws: uWS.WebSocket<unknown>,
    message: T,
    binary: boolean = false,
  ) {
    try {
      ws.send(JSON.stringify(message), binary, true);
    } catch (error) {
      console.error('Error sending message:', error);
      this.cleanupConnection(ws);
    }
  }

  private static generateSocketId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  /**
   * Emit event to all connected sockets (public room equivalent)
   * @param {string} event - Event name
   * @param {T} data - Event data
   * @param {boolean} binary - Send as binary message
   */
  static emit<T>(event: string, data: T, binary: boolean = false) {
    const message = { event, ...data };

    this.allSockets.forEach((ws) => {
      this.sendMessage(ws, message, binary);
    });
  }

  /**
   * Emit event to specific user
   * @param {User} user - User object
   * @param {string} event - Event name
   * @param {T} data - Event data
   * @param {boolean} binary - Send as binary message
   */
  static emitToUser<T>(
    user: User,
    event: string,
    data: T,
    binary: boolean = false,
  ) {
    const sockets = this.userSocketMap.get(user.id);
    if (sockets) {
      const message = { event, ...data };
      sockets.forEach((ws) => this.sendMessage(ws, message, binary));
    }
  }

  /**
   * Emit event to all users with specific role
   * @param {Role} role - Role object
   * @param {string} event - Event name
   * @param {T} data - Event data
   * @param {boolean} binary - Send as binary message
   */
  static async emitToRole<T>(
    role: Role,
    event: string,
    data: T,
    binary: boolean = false,
  ) {
    try {
      const userRoles = await prisma.role.findUnique({
        where: { id: role.id },
        include: {
          User: {
            select: {
              id: true,
            },
          },
        },
      });

      const message = { event, ...data };

      userRoles?.User.forEach((user) => {
        const sockets = this.userSocketMap.get(user.id);
        if (sockets) {
          sockets.forEach((ws) => this.sendMessage(ws, message, binary));
        }
      });
    } catch (error) {
      console.error('Database error in emitToRole:', error);
    }
  }

  /**
   * Emit to authenticated users only
   * @param {string} event - Event name
   * @param {T} data - Event data
   * @param {boolean} binary - Send as binary message
   */
  static emitToAuthenticated<T>(
    event: string,
    data: T,
    binary: boolean = false,
  ) {
    const message = { event, ...data };

    this.allSockets.forEach((ws) => {
      if (this.wsUserMap.has(ws)) {
        this.sendMessage(ws, message, binary);
      }
    });
  }

  /**
   * Emit to unauthenticated users only
   * @param {string} event - Event name
   * @param {T} data - Event data
   * @param {boolean} binary - Send as binary message
   */
  static emitToUnauthenticated<T>(
    event: string,
    data: T,
    binary: boolean = false,
  ) {
    const message = { event, ...data };

    this.allSockets.forEach((ws) => {
      if (!this.wsUserMap.has(ws)) {
        this.sendMessage(ws, message, binary);
      }
    });
  }

  /**
   * Get connection statistics
   */
  static getConnectionStats() {
    const authenticatedCount = [...this.userSocketMap.values()].reduce(
      (sum, s) => sum + s.size,
      0,
    );

    return {
      totalConnections: this.allSockets.size,
      authenticatedConnections: authenticatedCount,
      unauthenticatedConnections: this.allSockets.size - authenticatedCount,
      totalUsers: this.userSocketMap.size,
    };
  }

  /**
   * Check if a user is connected
   * @param {number} userId - User ID
   */
  static isUserConnected(userId: number): boolean {
    return this.userSocketMap.has(userId);
  }

  /**
   * Get user's socket count
   * @param {number} userId - User ID
   */
  static getUserSocketCount(userId: number): number {
    return this.userSocketMap.get(userId)?.size || 0;
  }
}

export default SocketUWS;
