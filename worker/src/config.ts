// 智会转录 Worker - 配置管理

import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量（优先从 server 目录）
const envPaths = [
    path.resolve(__dirname, '../.env'),          // worker/.env
    path.resolve(__dirname, '../../server/.env'), // server/.env
    path.resolve(__dirname, '../../.env'),        // web/.env
];

for (const envPath of envPaths) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
        console.log(`📂 Loaded env from: ${envPath}`);
        break;
    }
}

export interface WorkerConfig {
    // 数据库
    dbPath: string;

    // 轮询配置
    submitterPollInterval: number;  // 提交 Worker 轮询间隔 (ms)
    pollerPollInterval: number;     // 轮询 Worker 轮询间隔 (ms)
    taskTimeout: number;            // 任务超时时间 (秒)
    maxRetries: number;             // 最大重试次数

    // 阿里云 DashScope
    dashscopeApiKey: string;

    // 腾讯云 COS
    cosSecretId: string;
    cosSecretKey: string;
    cosBucket: string;
    cosRegion: string;

    // 日志级别
    logLevel: string;
}

export function loadConfig(): WorkerConfig {
    return {
        // 数据库路径 - 使用 server 的数据库
        dbPath: process.env.DB_PATH || path.resolve(__dirname, '../../server/data/meeting.db'),

        // 轮询配置
        submitterPollInterval: parseInt(process.env.SUBMITTER_POLL_INTERVAL || '5000', 10),
        pollerPollInterval: parseInt(process.env.POLLER_POLL_INTERVAL || '5000', 10),
        taskTimeout: parseInt(process.env.TASK_TIMEOUT || '1800', 10),  // 30 分钟
        maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),

        // 阿里云 DashScope
        dashscopeApiKey: process.env.DASHSCOPE_API_KEY || '',

        // 腾讯云 COS
        cosSecretId: process.env.COS_SECRET_ID || '',
        cosSecretKey: process.env.COS_SECRET_KEY || '',
        cosBucket: process.env.COS_BUCKET || '',
        cosRegion: process.env.COS_REGION || 'ap-guangzhou',

        // 日志级别
        logLevel: process.env.LOG_LEVEL || 'info',
    };
}

export const config = loadConfig();
