// 智会转录 Worker - 任务提交 Worker
// 职责: 轮询 pending 状态的任务，提交到阿里云 ASR

import { getDatabase } from '../db.js';
import { config } from '../config.js';
import { submitterLogger } from '../utils/logger.js';
import { listFiles, getFileUrl, parseUserIdFromFilename, parseCosPath } from '../utils/cos.js';
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

        // 查找待处理的任务（包含 room_id 和 trtc_task_id）
        const task = db.prepare(`
            SELECT id, meeting_id, room_id, trtc_task_id, retry_count 
            FROM transcription_tasks 
            WHERE status = 'pending' 
            ORDER BY created_at ASC 
            LIMIT 1
        `).get() as {
            id: number;
            meeting_id: string;
            room_id: string | null;
            trtc_task_id: string | null;
            retry_count: number
        } | undefined;

        if (!task) {
            isProcessing = false;
            return;
        }

        const roomId = task.room_id || task.meeting_id;
        submitterLogger.info({
            taskId: task.id,
            roomId,
            trtcTaskId: task.trtc_task_id
        }, '📋 Found pending task');

        // 标记为提交中
        db.prepare(`
            UPDATE transcription_tasks 
            SET status = 'processing', started_at = strftime('%s', 'now')
            WHERE id = ?
        `).run(task.id);

        submitterLogger.info({ taskId: task.id }, '⏳ Task status set to processing');

        // 处理任务
        await processTask(roomId, task.trtc_task_id, task.id);

    } catch (error) {
        submitterLogger.error({ error }, 'Submitter poll error');
    } finally {
        isProcessing = false;
    }
}

/**
 * 处理单个任务：扫描 COS、创建录制记录、提交转录
 * 
 * @param roomId 会议室 ID
 * @param trtcTaskId TRTC 录制任务 ID（可选，用于过滤特定录制会话）
 * @param taskId 转录任务 ID
 */
async function processTask(roomId: string, trtcTaskId: string | null, taskId: number): Promise<void> {
    const db = getDatabase();

    try {
        submitterLogger.info({ roomId, trtcTaskId }, '🔄 Processing transcription task');

        // ========== 步骤 1: 扫描 COS 获取录制文件 ==========
        // 如果指定了 trtcTaskId，则只扫描该任务的文件
        const prefix = trtcTaskId
            ? `meeting/room_${roomId}/${trtcTaskId}/`
            : `meeting/room_${roomId}/`;

        let cosFiles: Array<{ key: string }> = [];

        try {
            cosFiles = await listFiles(prefix);
        } catch (err) {
            submitterLogger.warn({ error: err, prefix }, 'COS scan failed');
        }

        const mp4Files = cosFiles.filter(f => f.key.endsWith('.mp4') || f.key.endsWith('_main.mp4'));
        submitterLogger.info({ count: mp4Files.length, prefix }, '📁 Found MP4 files in COS');

        // 为每个 COS 文件创建缺失的录制记录
        for (const file of mp4Files) {
            const existing = db.prepare(`
                SELECT id FROM recordings WHERE cos_file_key = ?
            `).get(file.key) as { id: string } | undefined;

            if (existing) {
                db.prepare(`UPDATE recordings SET meeting_id = ? WHERE id = ?`).run(roomId, existing.id);
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
            `).run(recordingId, roomId, fileUrl, file.key, userName ? `${userName} 的录制` : `录制文件`, userId, userName);

            submitterLogger.info({ recordingId, cosKey: file.key, userName }, '➕ Created new recording record');
        }

        // ========== 步骤 2: 获取所有录制并提交转录 ==========
        // 如果指定了 trtcTaskId，只获取对应 COS 路径的录制
        let recordings;
        if (trtcTaskId) {
            recordings = db.prepare(`
                SELECT id, cos_file_key, user_id, user_name
                FROM recordings 
                WHERE meeting_id = ? AND status = 'completed' 
                AND cos_file_key LIKE ?
                ORDER BY started_at ASC
            `).all(roomId, `%/${trtcTaskId}/%`) as Array<{
                id: string;
                cos_file_key: string | null;
                user_id: string | null;
                user_name: string | null;
            }>;
        } else {
            recordings = db.prepare(`
                SELECT id, cos_file_key, user_id, user_name
                FROM recordings 
                WHERE meeting_id = ? AND status = 'completed' AND cos_file_key IS NOT NULL
                ORDER BY started_at ASC
            `).all(roomId) as Array<{
                id: string;
                cos_file_key: string | null;
                user_id: string | null;
                user_name: string | null;
            }>;
        }

        if (recordings.length === 0) {
            throw new Error('No completed recordings found');
        }

        submitterLogger.info({ count: recordings.length, roomId, trtcTaskId }, '📼 Found recordings to transcribe');

        // 为每个录制提交转录
        let submittedCount = 0;
        let skippedCount = 0;
        for (const recording of recordings) {
            const result = await submitRecordingTranscription(recording, roomId);
            if (result === 'submitted') submittedCount++;
            else if (result === 'skipped') skippedCount++;
        }

        // ========== 步骤 3: 更新任务状态和统计 ==========
        const processingTime = Date.now() - (db.prepare(`SELECT started_at FROM transcription_tasks WHERE id = ?`).get(taskId) as { started_at: number })?.started_at * 1000 || 0;

        if (submittedCount > 0) {
            db.prepare(`
                UPDATE transcription_tasks 
                SET status = 'processing',
                    total_recordings = ?,
                    submitted_count = ?,
                    skipped_count = ?
                WHERE id = ?
            `).run(recordings.length, submittedCount, skippedCount, taskId);
            submitterLogger.info({ taskId, submittedCount, skippedCount, total: recordings.length }, '📤 Task submitted to ASR');
        } else {
            // 没有提交任何转录，直接标记完成
            db.prepare(`
                UPDATE transcription_tasks 
                SET status = 'completed', 
                    completed_at = strftime('%s', 'now'),
                    total_recordings = ?,
                    skipped_count = ?,
                    processing_time_ms = ?
                WHERE id = ?
            `).run(recordings.length, skippedCount, processingTime, taskId);
            submitterLogger.info({ taskId, skippedCount, total: recordings.length }, '✅ Task completed (no new transcriptions needed)');
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        submitterLogger.error({ roomId, trtcTaskId, error: errorMessage }, 'Task processing failed');

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
): Promise<'submitted' | 'skipped' | 'failed'> {
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
            submitterLogger.info({
                recordingId: recording.id,
                transcriptionId: existingTranscription.id,
                textLength: existingTranscription.full_text.length
            }, '⏭️ Skipping: transcription already completed');
            return 'skipped';
        }
        if (existingTranscription.status === 'processing') {
            submitterLogger.info({
                recordingId: recording.id,
                transcriptionId: existingTranscription.id
            }, '⏭️ Skipping: transcription in progress');
            return 'skipped';
        }
        // 失败或无内容的删除重试
        submitterLogger.info({
            recordingId: recording.id,
            oldStatus: existingTranscription.status,
            hasText: !!existingTranscription.full_text
        }, '🔄 Deleting failed transcription for retry');
        db.prepare(`DELETE FROM transcriptions WHERE id = ?`).run(existingTranscription.id);
    }

    if (!recording.cos_file_key) {
        submitterLogger.warn({ recordingId: recording.id }, '⚠️ No COS file, skipping');
        return 'skipped';
    }

    // 获取文件 URL
    const fileUrl = await getFileUrl(recording.cos_file_key, 7200);

    // 提交转录
    const result = await submitTranscription(fileUrl);

    if (!result.success || !result.taskId) {
        submitterLogger.error({ recordingId: recording.id, error: result.error }, '❌ Failed to submit transcription');
        return 'failed';
    }

    // 创建转录记录（包含元数据）
    const transcriptionId = uuidv4();
    const submittedAt = Math.floor(Date.now() / 1000);

    db.prepare(`
        INSERT INTO transcriptions (id, recording_id, task_id, status, alibaba_task_id, submitted_file_url, submitted_at)
        VALUES (?, ?, ?, 'processing', ?, ?, ?)
    `).run(transcriptionId, recording.id, result.taskId, result.taskId, fileUrl, submittedAt);

    submitterLogger.info({
        transcriptionId,
        recordingId: recording.id,
        alibabaTaskId: result.taskId,
        fileUrl: fileUrl.substring(0, 60) + '...'
    }, '📤 Transcription submitted');

    return 'submitted';
}

export default {
    startSubmitterWorker,
    stopSubmitterWorker,
};
