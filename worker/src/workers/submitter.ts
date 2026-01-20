// 智会转录 Worker - 任务提交 Worker
// 职责: 轮询 pending 状态的任务，提交到阿里云 ASR

import { getDatabase } from '../db.js';
import { config } from '../config.js';
import { submitterLogger } from '../utils/logger.js';
import { listFiles, getFileUrl, parseUserIdFromFilename } from '../utils/cos.js';
import { submitTranscription } from '../services/asr.js';
import { v4 as uuidv4 } from 'uuid';

let pollTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

/**
 * 启动提交 Worker
 */
export function startSubmitterWorker(): void {
    submitterLogger.info({
        pollInterval: config.submitterPollInterval
    }, 'Starting submitter worker');

    pollTimer = setInterval(() => {
        pollAndSubmit();
    }, config.submitterPollInterval);

    // 立即执行一次
    pollAndSubmit();
}

/**
 * 停止提交 Worker
 */
export function stopSubmitterWorker(): void {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        submitterLogger.info('Submitter worker stopped');
    }
}

/**
 * 轮询并提交任务
 */
async function pollAndSubmit(): Promise<void> {
    if (isProcessing) {
        return;
    }

    isProcessing = true;

    try {
        const db = getDatabase();

        // 查找待处理的任务
        const task = db.prepare(`
            SELECT id, meeting_id, retry_count 
            FROM transcription_tasks 
            WHERE status = 'pending' 
            ORDER BY created_at ASC 
            LIMIT 1
        `).get() as { id: number; meeting_id: string; retry_count: number } | undefined;

        if (!task) {
            isProcessing = false;
            return;
        }

        submitterLogger.info({ taskId: task.id, meetingId: task.meeting_id }, 'Found pending task');

        // 标记为提交中
        db.prepare(`
            UPDATE transcription_tasks 
            SET status = 'submitting', started_at = strftime('%s', 'now')
            WHERE id = ?
        `).run(task.id);

        // 处理任务
        await processTask(task.meeting_id, task.id);

    } catch (error) {
        submitterLogger.error({ error }, 'Submitter poll error');
    } finally {
        isProcessing = false;
    }
}

/**
 * 处理单个任务：扫描 COS、创建录制记录、提交转录
 */
async function processTask(meetingId: string, taskId: number): Promise<void> {
    const db = getDatabase();

    try {
        submitterLogger.info({ meetingId }, 'Processing meeting transcription');

        // ========== 步骤 1: 扫描 COS 补充录制记录 ==========
        const prefix = `meeting/room_${meetingId}/`;
        let cosFiles: Array<{ key: string }> = [];

        try {
            cosFiles = await listFiles(prefix);
        } catch (err) {
            submitterLogger.warn({ error: err, prefix }, 'COS scan failed');
        }

        const mp4Files = cosFiles.filter(f => f.key.endsWith('.mp4') || f.key.endsWith('_main.mp4'));
        submitterLogger.info({ count: mp4Files.length }, 'Found MP4 files in COS');

        // 为每个 COS 文件创建缺失的录制记录
        for (const file of mp4Files) {
            const existing = db.prepare(`
                SELECT id FROM recordings WHERE cos_file_key = ?
            `).get(file.key) as { id: string } | undefined;

            if (existing) {
                db.prepare(`UPDATE recordings SET meeting_id = ? WHERE id = ?`).run(meetingId, existing.id);
                continue;
            }

            const userId = parseUserIdFromFilename(file.key);
            let userName: string | null = null;

            if (userId) {
                const user = db.prepare(`SELECT name FROM users WHERE id = ?`).get(userId) as { name: string } | undefined;
                if (user?.name) {
                    userName = user.name;
                } else {
                    const member = db.prepare(`SELECT user_name FROM meeting_members WHERE user_id = ? LIMIT 1`).get(userId) as { user_name: string } | undefined;
                    userName = member?.user_name || userId.substring(0, 8);
                }
            }

            const fileUrl = await getFileUrl(file.key);
            const recordingId = uuidv4();

            db.prepare(`
                INSERT INTO recordings (id, meeting_id, task_id, started_by, started_at, ended_at, status, visibility, file_url, cos_file_key, title, user_id, user_name, record_mode)
                VALUES (?, ?, NULL, 'system', strftime('%s', 'now'), strftime('%s', 'now'), 'completed', 'host_only', ?, ?, ?, ?, ?, 'single')
            `).run(recordingId, meetingId, fileUrl, file.key, userName ? `${userName} 的录制` : `录制文件`, userId, userName);

            submitterLogger.info({ recordingId, userName }, 'Created recording record');
        }

        // ========== 步骤 2: 获取所有录制并提交转录 ==========
        const recordings = db.prepare(`
            SELECT id, cos_file_key, user_id, user_name
            FROM recordings 
            WHERE meeting_id = ? AND status = 'completed' AND cos_file_key IS NOT NULL
            ORDER BY started_at ASC
        `).all(meetingId) as Array<{
            id: string;
            cos_file_key: string | null;
            user_id: string | null;
            user_name: string | null;
        }>;

        if (recordings.length === 0) {
            throw new Error('No completed recordings found');
        }

        submitterLogger.info({ count: recordings.length }, 'Found recordings to transcribe');

        // 为每个录制提交转录
        let submittedCount = 0;
        for (const recording of recordings) {
            const submitted = await submitRecordingTranscription(recording, meetingId);
            if (submitted) submittedCount++;
        }

        // ========== 步骤 3: 更新任务状态为轮询中 ==========
        if (submittedCount > 0) {
            db.prepare(`
                UPDATE transcription_tasks 
                SET status = 'polling'
                WHERE id = ?
            `).run(taskId);
            submitterLogger.info({ taskId, submittedCount }, 'Task moved to polling status');
        } else {
            // 没有提交任何转录，直接标记完成
            db.prepare(`
                UPDATE transcription_tasks 
                SET status = 'completed', completed_at = strftime('%s', 'now')
                WHERE id = ?
            `).run(taskId);
            submitterLogger.info({ taskId }, 'Task completed (no new transcriptions needed)');
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        submitterLogger.error({ meetingId, error: errorMessage }, 'Task processing failed');

        const task = db.prepare(`SELECT retry_count FROM transcription_tasks WHERE id = ?`).get(taskId) as { retry_count: number } | undefined;
        const retryCount = (task?.retry_count || 0) + 1;

        if (retryCount >= config.maxRetries) {
            db.prepare(`
                UPDATE transcription_tasks 
                SET status = 'failed', error_message = ?, retry_count = ?, completed_at = strftime('%s', 'now')
                WHERE id = ?
            `).run(errorMessage, retryCount, taskId);
            submitterLogger.error({ taskId, retryCount }, 'Task failed after max retries');
        } else {
            db.prepare(`
                UPDATE transcription_tasks 
                SET status = 'pending', error_message = ?, retry_count = ?
                WHERE id = ?
            `).run(errorMessage, retryCount, taskId);
            submitterLogger.warn({ taskId, retryCount, maxRetries: config.maxRetries }, 'Task will retry');
        }
    }
}

/**
 * 提交单个录制的转录
 */
async function submitRecordingTranscription(
    recording: { id: string; cos_file_key: string | null },
    meetingId: string
): Promise<boolean> {
    const db = getDatabase();

    // 检查是否已有转录
    const existingTranscription = db.prepare(`
        SELECT id, status, full_text FROM transcriptions 
        WHERE recording_id = ? 
        ORDER BY created_at DESC 
        LIMIT 1
    `).get(recording.id) as { id: string; status: string; full_text: string | null } | undefined;

    if (existingTranscription) {
        if (existingTranscription.status === 'completed' && existingTranscription.full_text) {
            submitterLogger.debug({ recordingId: recording.id }, 'Transcription already completed, skipping');
            return false;
        }
        if (existingTranscription.status === 'processing' || existingTranscription.status === 'polling') {
            submitterLogger.debug({ recordingId: recording.id }, 'Transcription in progress, skipping');
            return false;
        }
        // 失败或无内容的删除重试
        db.prepare(`DELETE FROM transcriptions WHERE id = ?`).run(existingTranscription.id);
    }

    if (!recording.cos_file_key) {
        submitterLogger.warn({ recordingId: recording.id }, 'No COS file, skipping');
        return false;
    }

    // 获取文件 URL
    const fileUrl = await getFileUrl(recording.cos_file_key, 7200);

    // 提交转录
    const result = await submitTranscription(fileUrl);

    if (!result.success || !result.taskId) {
        throw new Error(result.error || 'Failed to submit transcription');
    }

    // 创建转录记录
    const transcriptionId = uuidv4();
    db.prepare(`
        INSERT INTO transcriptions (id, recording_id, task_id, status)
        VALUES (?, ?, ?, 'polling')
    `).run(transcriptionId, recording.id, result.taskId);

    submitterLogger.info({
        transcriptionId,
        recordingId: recording.id,
        alibabaTaskId: result.taskId
    }, 'Transcription submitted');

    return true;
}

export default {
    startSubmitterWorker,
    stopSubmitterWorker,
};
