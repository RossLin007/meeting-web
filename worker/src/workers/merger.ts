// 智会转录 Worker - Merger 模块
// 负责将多个单流转录合并为会议级完整转录

import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../db.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';
import { getFileUrl } from '../utils/cos.js';

const mergerLogger = logger.child({ module: 'merger' });

// 会议转录片段类型
interface MergedSegment {
    userId: string;
    userName: string;
    beginTime: number;
    endTime: number;
    text: string;
}

// 参与者类型
interface Participant {
    userId: string;
    userName: string;
}

/**
 * 合并会议的所有转录
 */
export async function mergeMeetingTranscription(meetingId: string): Promise<void> {
    const db = getDatabase();

    mergerLogger.info({ meetingId }, '🔀 Starting meeting transcription merge');

    try {
        // 获取会议信息
        const meeting = db.prepare(`
            SELECT id, title, started_at, ended_at FROM meetings WHERE id = ?
        `).get(meetingId) as {
            id: string;
            title: string;
            started_at: number | null;
            ended_at: number | null;
        } | undefined;

        if (!meeting) {
            throw new Error(`Meeting not found: ${meetingId}`);
        }

        // 获取所有已完成的录制及其转录
        const recordings = db.prepare(`
            SELECT 
                r.id as recording_id,
                r.user_id,
                r.user_name,
                r.cos_file_key,
                r.started_at,
                t.id as transcription_id,
                t.status as transcription_status,
                t.full_text
            FROM recordings r
            LEFT JOIN transcriptions t ON t.recording_id = r.id AND t.status = 'completed'
            WHERE r.meeting_id = ? AND r.status = 'completed'
            ORDER BY r.started_at ASC
        `).all(meetingId) as Array<{
            recording_id: string;
            user_id: string | null;
            user_name: string | null;
            cos_file_key: string | null;
            started_at: number;
            transcription_id: string | null;
            transcription_status: string | null;
            full_text: string | null;
        }>;

        if (recordings.length === 0) {
            throw new Error('No recordings found for meeting');
        }

        // 统计
        const totalRecordings = recordings.length;
        const completedTranscriptions = recordings.filter(r => r.transcription_status === 'completed').length;
        const failedOrPending = totalRecordings - completedTranscriptions;

        mergerLogger.info({
            meetingId,
            totalRecordings,
            completedTranscriptions,
            failedOrPending
        }, '📊 Recording stats');

        // 获取每个录制的精确开始时间（从 m3u8）
        const recordingsWithTime = await Promise.all(
            recordings.filter(r => r.transcription_id && r.cos_file_key).map(async (r) => {
                let preciseStartTime = r.started_at * 1000;

                // 尝试从 m3u8 获取精确时间
                if (r.cos_file_key) {
                    const m3u8Key = r.cos_file_key.replace('.mp4', '_audio.m3u8').replace('_main.mp4', '_main_audio.m3u8');
                    try {
                        const m3u8Url = await getFileUrl(m3u8Key, 300);
                        const response = await fetch(m3u8Url);
                        if (response.ok) {
                            const content = await response.text();
                            const match = content.match(/#EXT-X-SESSION-DATA:DATA-ID="START-REC-TIME",VALUE="(\d+)"/);
                            if (match) {
                                preciseStartTime = parseInt(match[1], 10);
                            }
                        }
                    } catch {
                        // 使用数据库时间作为回退
                    }
                }

                return {
                    ...r,
                    preciseStartTime
                };
            })
        );

        // 计算基准时间（最早的开始时间）
        const baseStartTime = recordingsWithTime.length > 0
            ? Math.min(...recordingsWithTime.map(r => r.preciseStartTime))
            : 0;

        // 收集参与者和片段
        const participantsMap = new Map<string, string>();
        const mergedSegments: MergedSegment[] = [];

        for (const recording of recordingsWithTime) {
            if (!recording.transcription_id) continue;

            // 计算时间偏移
            const timeOffset = recording.preciseStartTime - baseStartTime;

            // 获取用户信息
            let userId = recording.user_id || 'unknown';
            let userName = recording.user_name || userId.substring(0, 8);

            // 记录参与者
            if (!participantsMap.has(userId)) {
                participantsMap.set(userId, userName);
            }

            // 获取转录片段
            const segments = db.prepare(`
                SELECT speaker_id, begin_time, end_time, text
                FROM transcription_segments
                WHERE transcription_id = ?
                ORDER BY begin_time ASC
            `).all(recording.transcription_id) as Array<{
                speaker_id: number;
                begin_time: number;
                end_time: number;
                text: string;
            }>;

            // 应用时间偏移并加入合并列表
            for (const seg of segments) {
                mergedSegments.push({
                    userId,
                    userName,
                    beginTime: seg.begin_time + timeOffset,
                    endTime: seg.end_time + timeOffset,
                    text: seg.text,
                });
            }

            mergerLogger.debug({
                recordingId: recording.recording_id,
                userName,
                segments: segments.length,
                offsetMs: timeOffset
            }, '📝 Merged recording');
        }

        // 按时间排序
        mergedSegments.sort((a, b) => a.beginTime - b.beginTime);

        // 生成完整文本
        const formatTime = (ms: number): string => {
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            if (hours > 0) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        const fullText = mergedSegments
            .map(seg => `[${formatTime(seg.beginTime)}] ${seg.userName}: ${seg.text}`)
            .join('\n');

        // 构建参与者列表
        const participants: Participant[] = Array.from(participantsMap.entries())
            .map(([id, name]) => ({ userId: id, userName: name }));

        // 计算统计数据
        const totalDuration = mergedSegments.length > 0
            ? Math.max(...mergedSegments.map(s => s.endTime))
            : 0;
        const totalWordCount = fullText.replace(/\s/g, '').length;

        // 保存或更新会议级转录
        const existingTranscript = db.prepare(`
            SELECT id FROM meeting_transcripts WHERE meeting_id = ?
        `).get(meetingId) as { id: string } | undefined;

        if (existingTranscript) {
            // 更新
            db.prepare(`
                UPDATE meeting_transcripts SET
                    full_text = ?,
                    segments_json = ?,
                    participants_json = ?,
                    total_duration_ms = ?,
                    total_word_count = ?,
                    recording_count = ?,
                    completed_count = ?,
                    failed_count = ?,
                    status = 'completed',
                    updated_at = strftime('%s', 'now')
                WHERE id = ?
            `).run(
                fullText,
                JSON.stringify(mergedSegments),
                JSON.stringify(participants),
                totalDuration,
                totalWordCount,
                totalRecordings,
                completedTranscriptions,
                failedOrPending,
                existingTranscript.id
            );
        } else {
            // 插入
            const transcriptId = uuidv4();
            db.prepare(`
                INSERT INTO meeting_transcripts (
                    id, meeting_id, full_text, segments_json, participants_json,
                    total_duration_ms, total_word_count, recording_count,
                    completed_count, failed_count, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
            `).run(
                transcriptId,
                meetingId,
                fullText,
                JSON.stringify(mergedSegments),
                JSON.stringify(participants),
                totalDuration,
                totalWordCount,
                totalRecordings,
                completedTranscriptions,
                failedOrPending
            );
        }

        mergerLogger.info({
            meetingId,
            segments: mergedSegments.length,
            participants: participants.length,
            wordCount: totalWordCount,
            durationMs: totalDuration
        }, '✅ Meeting transcription merged successfully');

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        mergerLogger.error({ meetingId, error: errorMessage }, '❌ Merge failed');

        // 记录失败状态
        const existingTranscript = db.prepare(`
            SELECT id FROM meeting_transcripts WHERE meeting_id = ?
        `).get(meetingId) as { id: string } | undefined;

        if (existingTranscript) {
            db.prepare(`
                UPDATE meeting_transcripts SET
                    status = 'failed',
                    error_message = ?,
                    updated_at = strftime('%s', 'now')
                WHERE id = ?
            `).run(errorMessage, existingTranscript.id);
        } else {
            db.prepare(`
                INSERT INTO meeting_transcripts (id, meeting_id, status, error_message)
                VALUES (?, ?, 'failed', ?)
            `).run(uuidv4(), meetingId, errorMessage);
        }

        throw error;
    }
}

export default {
    mergeMeetingTranscription,
};
