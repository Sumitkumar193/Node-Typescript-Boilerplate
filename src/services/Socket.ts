import { Server, Socket as ISocket } from 'socket.io';
import { Server as IServer } from 'node:http';
import { Role, User } from '@prisma/client';
import AppException from '@errors/AppException';
import TokenService from '@services/TokenService';
import prisma from '@database/Prisma';
import validateOrigin from '@services/CorsService';

/**
 * @class Socket
 * @description Socket class to handle socket connections
 * @static init
 * @static emit
 * @static emitToUser
 *
 * @property {Server} io - Socket server instance
 * @property {Map<string, ISocket>} idSocketMap - Map of socket id and socket instance
 * @property {Map<string, Set<string>>} userSocketIdMap - Map of user id and socket id
 *
 * @method init - Initialize socket server
 * @method emit - Emit event to all connected sockets
 * @method emitToUser - Emit event to specific user
 * @method addUserToRoom - Add user to specific room
 *
 * @exports Socket
 */
class Socket {
  private static io: Server;

  private static idSocketMap: Map<string, ISocket> = new Map();

  private static userSocketIdMap: Map<number, Set<string>> = new Map();

  private static roomMembers: Map<string, Set<number>> = new Map();
  
  private static startedRooms: Set<string> = new Set();

  static init(server: IServer) {
    this.io = new Server(server, {
      cors: {
        origin: (origin, callback) => {
          if (!origin || validateOrigin(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
      },
    });

    this.io.on('connection', async (socket: ISocket) => {
      this.idSocketMap.set(socket.id, socket);
      socket.join('public');

      let currentUser: User | null = null;
      let authenticated = false;

      const handleAuth = async (
        accessToken?: string | undefined,
      ): Promise<User | null> => {
        const token =
          accessToken ??
          socket.handshake.headers.cookie?.split('accessToken=')[1];
        if (!token) return null;

        const user = await TokenService.getUserFromToken(token);
        if (user) {
          this.addUserToRoom(user, socket.id);
          currentUser = user;
          authenticated = true;
          return user;
        }
        return null;
      };

      // Require authentication before any conference actions
      const requireAuth = async (cb: Function) => {
        if (!authenticated) {
          await handleAuth();
        }
        if (!authenticated || !currentUser) {
          socket.emit('auth-required');
          return false;
        }
        return cb();
      };

      socket.on(
        'identify',
        async ({ accessToken }: { accessToken?: string }) => {
          const user = await handleAuth(accessToken);
          if (user) {
            this.io.to(user.id.toString()).emit('identified', {
              name: user.name,
              email: user.email,
            });
          } else {
            socket.emit('auth-required');
          }
        },
      );

      // Invite a user to a started room
      socket.on('invite-user', ({ roomId, userId }) => {
        requireAuth(() => {
          if (!Socket.startedRooms.has(roomId)) return;
          const members = Socket.roomMembers.get(roomId);
          if (!members || !members.has(currentUser!.id)) return;
          if (!Socket.roomMembers.has(roomId)) Socket.roomMembers.set(roomId, new Set());
          Socket.roomMembers.get(roomId)?.add(userId);
          // Optionally notify the invited user
          this.io.to(userId.toString()).emit('invited-to-room', { roomId });
        });
      });

      // Modified join-room logic
      socket.on('join-room', async ({ roomId }) => {
        requireAuth(() => {
          let members = Socket.roomMembers.get(roomId);
          if (!Socket.startedRooms.has(roomId)) {
            // Room not started: allow anyone to join and start the room
            if (!members) {
              members = new Set();
              Socket.roomMembers.set(roomId, members);
            }
            members.add(currentUser!.id);
            Socket.startedRooms.add(roomId);
            socket.join(roomId);
            socket.to(roomId).emit('user-joined', { socketId: socket.id });
          } else {
            if (members && members.has(currentUser!.id)) {
              socket.join(roomId);
              socket.to(roomId).emit('user-joined', { socketId: socket.id });
            } else {
              socket.emit('join-room-denied', { roomId, reason: 'Not invited' });
            }
          }
        });
      });

      socket.on('offer', ({ targetSocketId, offer }) => {
        requireAuth(() => {
          socket.to(targetSocketId).emit('offer', { socketId: socket.id, offer });
        });
      });

      socket.on('answer', ({ targetSocketId, answer }) => {
        requireAuth(() => {
          socket.to(targetSocketId).emit('answer', { socketId: socket.id, answer });
        });
      });

      socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
        requireAuth(() => {
          socket.to(targetSocketId).emit('ice-candidate', { socketId: socket.id, candidate });
        });
      });

      socket.on('disconnecting', () => {
        socket.rooms.forEach((roomId) => {
          socket.to(roomId).emit('user-left', { socketId: socket.id });
        });
      });

      socket.on('disconnect', () => {
        this.idSocketMap.get(socket.id)?.leave('public');
        this.idSocketMap.delete(socket.id);

        this.userSocketIdMap.forEach((sockets, userId) => {
          if (sockets.has(socket.id)) {
            socket.leave(userId.toString());
            sockets.delete(socket.id);
            if (sockets.size === 0) {
              this.userSocketIdMap.delete(userId);
            }
          }
        });
        console.log('Socket disconnected', socket.id);
      });

      await handleAuth();
      console.log('Socket connected', socket.id);
    });
  }

  /**
   * Emit event to all connected sockets
   * @param {string} event - Event name
   * @param {T} data - Event data
   */
  static emit<T>(event: string, data: T) {
    this.io.to('public').emit(event, data);
  }

  /**
   * Emit event to specific user
   * @param {User} user - User id
   * @param {string} event - Event name
   * @param {T} data - Event data
   */
  static emitToUser<T>(user: User, event: string, data: T) {
    this.io.to(user.id.toString()).emit(event, data);
  }

  /**
   * Emit event to all users with specific role
   * @param {Role} role
   * @param {string} event
   * @param {T} data
   */
  static async emitToRole<T>(role: Role, event: string, data: T) {
    // Fix: select userId, not id, from userRole
    const userRoles = await prisma.userRole.findMany({
      where: {
        roleId: role.id,
      },
      select: {
        userId: true,
      },
    });

    userRoles.forEach((userRole) => {
      this.io.to(userRole.userId.toString()).emit(event, data);
    });
  }

  /**
   * Attach event to all connected sockets
   * @param {string} event - Event name
   * @param {(data: T) => void} callback - Event callback
   */
  static attachEvent<T>(event: string, callback: (data: T) => void) {
    this.io.on(event, callback);
  }

  /**
   * Add user to specific room
   * @param {User} user - User data
   * @param {string} socketId - Socket id
   */
  private static addUserToRoom(user: User, socketId: string): void {
    try {
      const userId = user.id;
      const socket = this.idSocketMap.get(socketId);
      if (!socket) {
        throw new AppException('Socket not found', 404);
      }
      socket.join(userId.toString());
      if (!this.userSocketIdMap.has(userId)) {
        this.userSocketIdMap.set(userId, new Set());
      }
      this.userSocketIdMap.get(userId)?.add(socketId);
      this.io.to(userId.toString()).emit('identified', {
        name: user.name,
        email: user.email,
        // Remove role: user.roles, as User does not have roles directly
      });
    } catch (error) {
      console.error(error);
    }
  }
}

export default Socket;
