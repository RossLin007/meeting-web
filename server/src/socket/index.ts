// 智会后端 - Socket.io 服务器初始化

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { registerHandlers } from './handlers';

let io: Server | null = null;

/**
 * 初始化 Socket.io 服务器
 */
export function initSocketServer(httpServer: HttpServer): Server {
    io = new Server(httpServer, {
        cors: {
            origin: ['http://localhost:3000', 'http://localhost:5173'],
            methods: ['GET', 'POST'],
            credentials: true,
        },
        // 连接配置
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // 认证中间件
    io.use((socket: Socket, next) => {
        const userId = socket.handshake.auth.userId as string;
        const userName = socket.handshake.auth.userName as string;

        if (!userId) {
            console.error('❌ Socket 连接被拒绝: 缺少 userId');
            return next(new Error('Authentication error: userId required'));
        }

        // 存储用户信息到 socket.data
        socket.data.userId = userId;
        socket.data.userName = userName || userId;

        console.log(`✅ Socket 认证通过: ${userId}`);
        next();
    });

    // 连接事件
    io.on('connection', (socket: Socket) => {
        console.log(`🔌 新连接: ${socket.id} (${socket.data.userId})`);

        // 注册所有事件处理器
        registerHandlers(io!, socket);
    });

    console.log('✅ Socket.io 服务器已初始化');
    return io;
}

/**
 * 获取 Socket.io 实例
 */
export function getIO(): Server | null {
    return io;
}

/**
 * 向指定房间广播消息
 */
export function broadcastToRoom(roomId: string, event: string, data: unknown): void {
    if (io) {
        io.to(roomId).emit(event, data);
    }
}

/**
 * 向指定用户发送消息
 */
export function sendToUser(userId: string, event: string, data: unknown): void {
    if (io) {
        // 需要通过 userSockets Map 获取用户的 socket
        // 这里简化实现，实际需要从 handlers.ts 导入
        io.emit(event, { ...data as object, targetUserId: userId });
    }
}

export default { initSocketServer, getIO, broadcastToRoom, sendToUser };
