// 智会转录 Worker - 结构化日志

import pino from 'pino';
import { config } from '../config.js';

export const logger = pino({
    level: config.logLevel,
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
        },
    },
});

// 创建子日志器
export const submitterLogger = logger.child({ worker: 'submitter' });
export const pollerLogger = logger.child({ worker: 'poller' });
export const dbLogger = logger.child({ module: 'db' });
export const asrLogger = logger.child({ module: 'asr' });
export const cosLogger = logger.child({ module: 'cos' });
