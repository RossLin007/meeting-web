// 智会转录 Worker - 入口文件

import { logger } from './utils/logger.js';
import { getDatabase, closeDatabase, resetTimedOutTasks } from './db.js';
import { startSubmitterWorker, stopSubmitterWorker } from './workers/submitter.js';
import { startPollerWorker, stopPollerWorker } from './workers/poller.js';
import { config } from './config.js';

/**
 * 启动 Worker 服务
 */
async function start(): Promise<void> {
    logger.info('========================================');
    logger.info('🚀 智会转录 Worker 服务启动');
    logger.info('========================================');
    logger.info({
        config: {
            submitterPollInterval: config.submitterPollInterval,
            pollerPollInterval: config.pollerPollInterval,
            taskTimeout: config.taskTimeout,
            maxRetries: config.maxRetries,
            logLevel: config.logLevel,
        }
    }, 'Configuration loaded');

    // 初始化数据库连接
    getDatabase();

    // 重置超时任务
    const resetCount = resetTimedOutTasks();
    if (resetCount > 0) {
        logger.warn({ count: resetCount }, 'Reset timed out tasks');
    }

    // 启动 Workers
    startSubmitterWorker();
    startPollerWorker();

    logger.info('✅ All workers started');
}

/**
 * 优雅关闭
 */
async function shutdown(): Promise<void> {
    logger.info('Shutting down...');

    stopSubmitterWorker();
    stopPollerWorker();
    closeDatabase();

    logger.info('👋 Worker service stopped');
    process.exit(0);
}

// 处理进程信号
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    process.exit(1);
});

// 启动
start().catch((error) => {
    logger.fatal({ error }, 'Failed to start worker service');
    process.exit(1);
});
