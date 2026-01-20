// 智会转录 Worker - 数据库连接

import Database from 'better-sqlite3';
import { config } from './config.js';
import { dbLogger } from './utils/logger.js';

let db: Database.Database | null = null;

/**
 * 获取数据库连接
 */
export function getDatabase(): Database.Database {
    if (!db) {
        dbLogger.info({ dbPath: config.dbPath }, 'Connecting to database');
        db = new Database(config.dbPath, { verbose: undefined });
        db.pragma('journal_mode = WAL');

        // 确保 transcription_tasks 表有 alibaba_task_id 字段
        ensureSchema();
    }
    return db;
}

/**
 * 确保数据库 schema 最新
 */
function ensureSchema(): void {
    if (!db) return;

    // 检查 alibaba_task_id 列是否存在
    const columns = db.prepare(`PRAGMA table_info(transcription_tasks)`).all() as Array<{ name: string }>;
    const hasAlibabaTaskId = columns.some(col => col.name === 'alibaba_task_id');

    if (!hasAlibabaTaskId) {
        dbLogger.info('Adding alibaba_task_id column to transcription_tasks');
        db.exec(`ALTER TABLE transcription_tasks ADD COLUMN alibaba_task_id TEXT`);
    }

    dbLogger.info('Database schema verified');
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
        dbLogger.info('Database connection closed');
    }
}

/**
 * 重置超时任务
 */
export function resetTimedOutTasks(): number {
    const db = getDatabase();
    const timeout = config.taskTimeout;

    const result = db.prepare(`
        UPDATE transcription_tasks 
        SET status = 'pending', 
            retry_count = retry_count + 1,
            error_message = 'Task timed out, will retry'
        WHERE status IN ('submitting', 'polling') 
          AND started_at < strftime('%s', 'now') - ?
    `).run(timeout);

    if (result.changes > 0) {
        dbLogger.warn({ count: result.changes, timeoutSeconds: timeout }, 'Reset timed out tasks');
    }

    return result.changes;
}
