import { Server, Socket as ISocket } from 'socket.io';
import { Server as IServer } from 'node:http';
import AppException from '../errors/AppException';
import TokenService from '../services/TokenService';

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

  private static userSocketIdMap: Map<string, Set<string>> = new Map();

  static init(server: IServer) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
      },
    });

    this.io.on('connection', async (socket: ISocket) => {
      this.idSocketMap.set(socket.id, socket);
      socket.join('public');

      const handleAuth = async () => {
        const token = socket.handshake.headers.cookie?.split('accessToken=')[1];
        if (!token) return null;

        const user = await TokenService.getUserFromToken(token);
        if (user) {
          this.addUserToRoom(user.id, socket.id);
          return user;
        }
        return null;
      };

      socket.on('identify', async () => {
        const user = await handleAuth();
        if (user) {
          this.io.to(user.id).emit('identified', 'User identified');
        }
      });

      socket.on('disconnect', () => {
        this.idSocketMap.get(socket.id)?.leave('public');
        this.idSocketMap.delete(socket.id);

        this.userSocketIdMap.forEach((sockets, userId) => {
          if (sockets.has(socket.id)) {
            socket.leave(userId);
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

  static emit<T>(event: string, data: T) {
    this.io.to('public').emit(event, data);
  }

  static emitToUser<T>(userId: string, event: string, data: T) {
    this.io.to(userId).emit(event, data);
  }

  private static addUserToRoom(userId: string, socketId: string): void {
    try {
      const socket = this.idSocketMap.get(socketId);
      if (!socket) {
        throw new AppException('Socket not found', 404);
      }
      socket.join(userId);
      if (!this.userSocketIdMap.has(userId)) {
        this.userSocketIdMap.set(userId, new Set());
      }
      this.userSocketIdMap.get(userId)?.add(socketId);

      this.io.to(userId).emit('identified', 'User identified');
      console.log('User connected', userId);
    } catch (error) {
      console.error(error);
    }
  }
}

export default Socket;
