// 智会后端 - 主入口

// 使用 dotenv/config 自动加载环境变量
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';

// 导入数据库
import { initDatabase } from './db';

// 导入 Socket.io
import { initSocketServer } from './socket';

// 导入路由
import recordingRoutes from './routes/recording';
import usersigRoutes from './routes/usersig';
import meetingsRoutes from './routes/meetings';
import usersRoutes from './routes/users';
import contactsRoutes from './routes/contacts';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// 初始化数据库
initDatabase();

// 初始化 Socket.io
initSocketServer(httpServer);

// 中间件
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
}));
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 调试接口 - 查看环境变量加载状态
app.get('/debug/config', (req, res) => {
    const secretId = process.env.TENCENT_SECRET_ID || '';
    const secretKey = process.env.TENCENT_SECRET_KEY || '';
    res.json({
        trtcSdkAppId: process.env.TRTC_SDK_APP_ID,
        secretIdPrefix: secretId.substring(0, 8),
        secretIdLength: secretId.length,
        secretKeyLength: secretKey.length,
        cosBucket: process.env.COS_BUCKET,
        cosRegion: process.env.COS_REGION,
    });
});

// API 路由
app.use('/api/recording', recordingRoutes);
app.use('/api/usersig', usersigRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use(usersRoutes);  // 用户路由（包含完整路径）
app.use('/api/contacts', contactsRoutes);

// 错误处理
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error',
    });
});

// 启动服务器 (使用 httpServer 而不是 app.listen)
httpServer.listen(PORT, () => {
    console.log(`
╭─────────────────────────────────────────╮
│                                         │
│   智会后端服务 🚀                        │
│                                         │
│   Server running on port ${PORT}          │
│   http://localhost:${PORT}                │
│   WebSocket: ws://localhost:${PORT}       │
│                                         │
╰─────────────────────────────────────────╯
    `);
    console.log('Environment loaded:', {
        secretIdPrefix: (process.env.TENCENT_SECRET_ID || '').substring(0, 8),
        hasSecretKey: !!(process.env.TENCENT_SECRET_KEY),
    });
    console.log('Available endpoints:');
    console.log('  GET  /health');
    console.log('  POST /api/meetings');
    console.log('  GET  /api/meetings/:id');
    console.log('  GET  /api/meetings/:id/state');
    console.log('  POST /api/meetings/:id/join');
    console.log('  POST /api/meetings/:id/leave');
    console.log('  POST /api/recording/start');
    console.log('  POST /api/recording/stop');
    console.log('  POST /api/usersig/generate');
    console.log('  GET  /api/contacts');
    console.log('  POST /api/contacts/sync');
    console.log('  GET  /api/contacts/groups');
    console.log('  WS   Socket.io (状态同步)');
});

export default app;


