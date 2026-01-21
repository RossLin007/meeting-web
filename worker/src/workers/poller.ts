// 智会转录 Worker - 结果轮询 Worker
// 职责: 轮询 polling 状态的转录记录，获取阿里云 ASR 结果

import { getDatabase } from '../db.js';
import { config } from '../config.js';
import { pollerLogger } from '../utils/logger.js';
import { queryTranscriptionStatus, parseTranscriptionResult } from '../services/asr.js';
import { mergeMeetingTranscription } from './merger.js';

let pollTimer: NodeJS.Timeout | null = null;
let isProcessing = false;

/**
 * 启动轮询 Worker
 */
export function startPollerWorker(): void {
    pollerLogger.info({
        pollInterval: config.pollerPollInterval
    }, 'Starting poller worker');

    pollTimer = setInterval(() => {
        pollAndCheck();
    }, config.pollerPollInterval);

    // 立即执行一次
    pollAndCheck();
}

/**
 * 停止轮询 Worker
 */
export function stopPollerWorker(): void {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        pollerLogger.info('Poller worker stopped');
    }
}

/**
 * 轮询并检查转录状态
 */
async function pollAndCheck(): Promise<void> {
    if (isProcessing) {
        return;
    }

    isProcessing = true;

    try {
        const db = getDatabase();

        // 查找正在轮询中的转录记录
        const transcriptions = db.prepare(`
            SELECT id, recording_id, task_id 
            FROM transcriptions 
            WHERE status = 'processing' AND task_id IS NOT NULL
            ORDER BY created_at ASC 
            LIMIT 10
        `).all() as Array<{ id: string; recording_id: string; task_id: string }>;

        if (transcriptions.length === 0) {
            isProcessing = false;
            return;
        }

        pollerLogger.info({ count: transcriptions.length }, '🔍 Checking transcription statuses');

        for (const transcription of transcriptions) {
            await checkTranscriptionStatus(transcription);
        }

        // 检查是否有任务可以标记为完成
        await checkTaskCompletion();

    } catch (error) {
        pollerLogger.error({ error }, 'Poller error');
    } finally {
        isProcessing = false;
    }
}

/**
 * 检查单个转录的状态
 */
async function checkTranscriptionStatus(transcription: {
    id: string;
    recording_id: string;
    task_id: string;
}): Promise<void> {
    const db = getDatabase();

    try {
        const status = await queryTranscriptionStatus(transcription.task_id);

        if (status.status === 'SUCCEEDED') {
            if (status.results && status.results.length > 0) {
                const transcriptionUrl = status.results[0].transcriptionUrl;
                const result = await parseTranscriptionResult(transcriptionUrl);

                // 计算音频时长（最后一个 segment 的 endTime）
                const audioDuration = result.segments.length > 0
                    ? Math.max(...result.segments.map(s => s.endTime))
                    : 0;

                // 计算字数
                const wordCount = result.fullText.replace(/\s/g, '').length;

                // 计算 ASR 处理时间
                const submittedAt = db.prepare(`SELECT submitted_at FROM transcriptions WHERE id = ?`).get(transcription.id) as { submitted_at: number } | undefined;
                const asrDuration = submittedAt?.submitted_at
                    ? (Math.floor(Date.now() / 1000) - submittedAt.submitted_at) * 1000
                    : null;

                // 保存转录内容（包含元数据）
                db.prepare(`
                    UPDATE transcriptions 
                    SET full_text = ?, 
                        status = 'completed', 
                        completed_at = strftime('%s', 'now'),
                        word_count = ?,
                        audio_duration_ms = ?,
                        asr_duration_ms = ?
                    WHERE id = ?
                `).run(result.fullText, wordCount, audioDuration, asrDuration, transcription.id);

                // 保存分段
                db.prepare(`DELETE FROM transcription_segments WHERE transcription_id = ?`).run(transcription.id);

                const insertSegment = db.prepare(`
                    INSERT INTO transcription_segments (transcription_id, speaker_id, begin_time, end_time, text)
                    VALUES (?, ?, ?, ?, ?)
                `);

                for (const segment of result.segments) {
                    insertSegment.run(
                        transcription.id,
                        segment.speakerId,
                        segment.beginTime,
                        segment.endTime,
                        segment.text
                    );
                }

                // 创建说话人标签
                db.prepare(`DELETE FROM speaker_labels WHERE transcription_id = ?`).run(transcription.id);

                const insertLabel = db.prepare(`
                    INSERT INTO speaker_labels (transcription_id, speaker_id, label)
                    VALUES (?, ?, ?)
                `);

                for (const speakerId of result.speakerIds) {
                    insertLabel.run(transcription.id, speakerId, `说话人 ${speakerId + 1}`);
                }

                pollerLogger.info({
                    transcriptionId: transcription.id,
                    wordCount,
                    segments: result.segments.length,
                    audioDurationMs: audioDuration,
                    asrDurationMs: asrDuration
                }, '✅ Transcription completed');
            }
        } else if (status.status === 'FAILED') {
            db.prepare(`
                UPDATE transcriptions 
                SET status = 'failed', error_message = ?, completed_at = strftime('%s', 'now')
                WHERE id = ?
            `).run(status.error || 'Unknown error', transcription.id);

            pollerLogger.error({
                transcriptionId: transcription.id,
                error: status.error
            }, 'Transcription failed');
        }
        // PENDING 和 RUNNING 状态不做处理，继续轮询

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        pollerLogger.error({
            transcriptionId: transcription.id,
            error: errorMessage
        }, 'Error checking transcription status');
    }
}

/**
 * 检查任务是否可以标记为完成
 */
async function checkTaskCompletion(): Promise<void> {
    const db = getDatabase();

    // 查找 processing 状态的任务
    const tasks = db.prepare(`
        SELECT DISTINCT tt.id, tt.meeting_id
        FROM transcription_tasks tt
        WHERE tt.status = 'processing'
    `).all() as Array<{ id: number; meeting_id: string }>;

    for (const task of tasks) {
        // 检查该会议的所有录制是否都完成了转录
        const recordings = db.prepare(`
            SELECT r.id,
                   t.status as transcription_status
            FROM recordings r
            LEFT JOIN transcriptions t ON t.recording_id = r.id
            WHERE r.meeting_id = ? AND r.status = 'completed' AND r.cos_file_key IS NOT NULL
        `).all(task.meeting_id) as Array<{ id: string; transcription_status: string | null }>;

        // 统计状态
        let completedCount = 0;
        let failedCount = 0;
        let processingCount = 0;

        for (const r of recordings) {
            if (r.transcription_status === 'processing') {
                processingCount++;
            } else if (r.transcription_status === 'failed') {
                failedCount++;
            } else if (r.transcription_status === 'completed') {
                completedCount++;
            }
        }

        if (processingCount === 0 && (completedCount > 0 || failedCount > 0)) {
            // 任务完成或失败
            const finalStatus = completedCount === 0 && failedCount > 0 ? 'failed' : 'completed';

            // 计算总处理时间
            const startedAt = db.prepare(`SELECT started_at FROM transcription_tasks WHERE id = ?`).get(task.id) as { started_at: number } | undefined;
            const processingTime = startedAt?.started_at
                ? (Math.floor(Date.now() / 1000) - startedAt.started_at) * 1000
                : null;

            db.prepare(`
                UPDATE transcription_tasks 
                SET status = ?, 
                    completed_at = strftime('%s', 'now'),
                    completed_count = ?,
                    failed_count = ?,
                    processing_time_ms = ?
                WHERE id = ?
            `).run(finalStatus, completedCount, failedCount, processingTime, task.id);

            pollerLogger.info({
                taskId: task.id,
                meetingId: task.meeting_id,
                status: finalStatus,
                completedCount,
                failedCount,
                processingTimeMs: processingTime
            }, `🏁 Task ${finalStatus}`);

            // 触发会议级转录合并
            if (finalStatus === 'completed' && completedCount > 0) {
                try {
                    await mergeMeetingTranscription(task.meeting_id);
                } catch (mergeError) {
                    pollerLogger.error({
                        meetingId: task.meeting_id,
                        error: mergeError instanceof Error ? mergeError.message : 'Unknown error'
                    }, '❌ Meeting merge failed');
                }
            }
        }
    }
}

export default {
    startPollerWorker,
    stopPollerWorker,
};
