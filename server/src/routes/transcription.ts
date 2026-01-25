// 智会后端 - 转录 API 路由

import { Router, Request, Response } from 'express';
import transcriptionService from '../services/transcription';
import { getDatabase } from '../db';
import { getFileUrl, parseUserIdFromFilename, listFiles } from '../utils/cos';

const router = Router();

/**
 * 获取所有转录任务列表
 * GET /api/transcription/list
 * 注意: 此路由必须放在 /:id 之前，否则 list 会被当作 id 处理
 * 
 * 返回以 roomId + trtcTaskId 为唯一标识的转录任务列表
 */
router.get('/list', async (req: Request, res: Response) => {
    console.log('');
    console.log('📋 [GET /api/transcription/list] 获取转录列表');

    try {
        const db = getDatabase();

        // 获取所有转录任务，按 room_id + trtc_task_id 分组
        // 同时关联会议信息和录制数量
        const tasks = db.prepare(`
            SELECT 
                tt.id as taskId,
                tt.meeting_id as meetingId,
                tt.room_id as roomId,
                tt.trtc_task_id as trtcTaskId,
                m.title as meetingTitle,
                m.started_at as startedAt,
                m.ended_at as endedAt,
                tt.status as taskStatus,
                tt.completed_at as taskCompletedAt,
                tt.error_message as taskError,
                tt.total_recordings as totalRecordings,
                tt.completed_count as completedCount,
                tt.failed_count as failedCount,
                tt.created_at as createdAt
            FROM transcription_tasks tt
            LEFT JOIN meetings m ON m.id = tt.meeting_id
            ORDER BY tt.created_at DESC
            LIMIT 100
        `).all() as Array<{
            taskId: number;
            meetingId: string;
            roomId: string | null;
            trtcTaskId: string | null;
            meetingTitle: string | null;
            startedAt: number | null;
            endedAt: number | null;
            taskStatus: string | null;
            taskCompletedAt: number | null;
            taskError: string | null;
            totalRecordings: number | null;
            completedCount: number | null;
            failedCount: number | null;
            createdAt: number;
        }>;

        // 映射任务状态到前端状态
        const result = tasks.map(t => {
            // 将 Worker 的任务状态映射到前端状态
            let transcriptionStatus: 'none' | 'processing' | 'completed' | 'failed' = 'none';

            if (t.taskStatus === 'completed') {
                transcriptionStatus = 'completed';
            } else if (t.taskStatus === 'submitting' || t.taskStatus === 'polling' ||
                t.taskStatus === 'processing' || t.taskStatus === 'pending') {
                transcriptionStatus = 'processing';
            } else if (t.taskStatus === 'failed') {
                transcriptionStatus = 'failed';
            }

            return {
                taskId: t.taskId,
                meetingId: t.meetingId,
                roomId: t.roomId || t.meetingId, // 向后兼容：如果没有 roomId，使用 meetingId
                trtcTaskId: t.trtcTaskId,
                meetingTitle: t.meetingTitle || `会议室 ${t.roomId || t.meetingId}`,
                startedAt: t.startedAt,
                endedAt: t.endedAt,
                recordingCount: t.totalRecordings || 0,
                completedCount: t.completedCount || 0,
                failedCount: t.failedCount || 0,
                transcriptionStatus,
                lastTranscriptAt: t.taskCompletedAt,
                taskError: t.taskError,
                createdAt: t.createdAt,
            };
        });

        console.log(`   ✅ 返回 ${result.length} 个转录任务`);

        return res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Get transcription list error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 手动触发转录
 * POST /api/transcription/trigger
 * 
 * 支持两种模式:
 * 1. 使用 meetingId 触发会议的所有录制转录（向后兼容）
 * 2. 使用 roomId + trtcTaskId 触发特定录制会话的转录
 * 
 * 只负责将转录任务添加到队列，实际的 COS 扫描和转录由独立 Worker 服务完成
 */
router.post('/trigger', async (req: Request, res: Response) => {
    console.log('');
    console.log('🎯 [POST /api/transcription/trigger] 手动触发转录');

    try {
        const { meetingId, roomId, trtcTaskId } = req.body;

        if (!meetingId && !roomId) {
            return res.status(400).json({
                success: false,
                error: 'meetingId or roomId is required',
            });
        }

        const db = getDatabase();
        const effectiveRoomId = roomId || meetingId;

        // 检查会议是否存在
        const meeting = db.prepare(`
            SELECT id, title, status FROM meetings WHERE id = ?
        `).get(meetingId || roomId) as { id: string; title: string; status: string } | undefined;

        console.log(`   📋 会议室: ${effectiveRoomId}, TRTC TaskId: ${trtcTaskId || 'auto'}`);

        // 检查是否已有待处理或进行中的任务
        let existing;
        if (trtcTaskId) {
            // 使用 roomId + trtcTaskId 精确匹配
            existing = db.prepare(`
                SELECT id FROM transcription_tasks 
                WHERE room_id = ? AND trtc_task_id = ? 
                AND status IN ('pending', 'submitting', 'polling', 'processing')
            `).get(effectiveRoomId, trtcTaskId) as { id: number } | undefined;
        } else {
            // 使用 meetingId 匹配（向后兼容）
            existing = db.prepare(`
                SELECT id FROM transcription_tasks 
                WHERE meeting_id = ? AND status IN ('pending', 'submitting', 'polling', 'processing')
            `).get(meetingId) as { id: number } | undefined;
        }

        let taskId: number;
        if (existing) {
            console.log(`   ⚠️ 已有进行中的转录任务: ${existing.id}`);
            taskId = existing.id;
        } else {
            // 创建新任务
            const result = db.prepare(`
                INSERT INTO transcription_tasks (meeting_id, room_id, trtc_task_id, status, created_at)
                VALUES (?, ?, ?, 'pending', strftime('%s', 'now'))
            `).run(meetingId || effectiveRoomId, effectiveRoomId, trtcTaskId || null);
            taskId = result.lastInsertRowid as number;
            console.log(`   ✅ 已添加转录任务: TaskID=${taskId}, RoomId=${effectiveRoomId}`);
        }

        return res.json({
            success: true,
            data: {
                taskId,
                meetingId: meetingId || effectiveRoomId,
                roomId: effectiveRoomId,
                trtcTaskId: trtcTaskId || null,
                message: 'Transcription task queued. Worker will scan COS and process recordings.',
            },
        });
    } catch (error) {
        console.error('Trigger transcription error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

// Note: POST /start 已移除 - Worker 的 submitter 负责提交转录任务

/**
 * 获取转录详情（包含分段和说话人标签）
 * GET /api/transcription/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const details = await transcriptionService.getTranscriptionDetails(id);

        if (!details) {
            return res.status(404).json({
                success: false,
                error: 'Transcription not found',
            });
        }

        return res.json({
            success: true,
            data: details,
        });
    } catch (error) {
        console.error('Get transcription error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 根据录制ID获取转录
 * GET /api/transcription/recording/:recordingId
 */
router.get('/recording/:recordingId', async (req: Request, res: Response) => {
    try {
        const { recordingId } = req.params;

        const transcription = await transcriptionService.getTranscriptionByRecordingId(recordingId);

        if (!transcription) {
            return res.json({
                success: true,
                data: null,
            });
        }

        // 获取完整详情
        const details = await transcriptionService.getTranscriptionDetails(transcription.id);

        return res.json({
            success: true,
            data: details,
        });
    } catch (error) {
        console.error('Get transcription by recording error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

// Note: POST /:id/sync 已移除 - Worker 的 poller 负责同步转录状态

/**
 * 更新说话人标签
 * PUT /api/transcription/:id/speakers
 */
router.put('/:id/speakers', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { speakerId, label } = req.body;

        if (speakerId === undefined || !label) {
            return res.status(400).json({
                success: false,
                error: 'speakerId and label are required',
            });
        }

        // 验证转录存在
        const db = getDatabase();
        const transcription = db.prepare(`
            SELECT id FROM transcriptions WHERE id = ?
        `).get(id);

        if (!transcription) {
            return res.status(404).json({
                success: false,
                error: 'Transcription not found',
            });
        }

        await transcriptionService.updateSpeakerLabel(id, speakerId, label);

        return res.json({
            success: true,
            message: 'Speaker label updated',
        });
    } catch (error) {
        console.error('Update speaker label error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取转录对应会议的参与者列表（用于说话人映射）
 * GET /api/transcription/:id/participants
 */
router.get('/:id/participants', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const db = getDatabase();

        // 获取转录记录
        const transcription = db.prepare(`
            SELECT recording_id FROM transcriptions WHERE id = ?
        `).get(id) as { recording_id: string } | undefined;

        if (!transcription) {
            return res.status(404).json({
                success: false,
                error: 'Transcription not found',
            });
        }

        // 获取录制对应的会议ID
        const recording = db.prepare(`
            SELECT meeting_id FROM recordings WHERE id = ?
        `).get(transcription.recording_id) as { meeting_id: string } | undefined;

        if (!recording) {
            return res.json({
                success: true,
                data: [],
            });
        }

        // 获取会议参与者
        const participants = db.prepare(`
            SELECT user_id, user_name, email FROM meeting_participants 
            WHERE meeting_id = ?
            ORDER BY user_name
        `).all(recording.meeting_id) as Array<{
            user_id: string;
            user_name: string;
            email: string | null;
        }>;

        // 获取会议成员（实时参与过的）
        const members = db.prepare(`
            SELECT DISTINCT user_id, user_name FROM meeting_members 
            WHERE meeting_id = ?
            ORDER BY user_name
        `).all(recording.meeting_id) as Array<{
            user_id: string;
            user_name: string;
        }>;

        // 合并参与者和成员（去重）
        const allParticipants = new Map<string, { userId: string; userName: string; email?: string }>();

        for (const p of participants) {
            allParticipants.set(p.user_id, {
                userId: p.user_id,
                userName: p.user_name,
                email: p.email || undefined,
            });
        }

        for (const m of members) {
            if (!allParticipants.has(m.user_id)) {
                allParticipants.set(m.user_id, {
                    userId: m.user_id,
                    userName: m.user_name,
                });
            }
        }

        return res.json({
            success: true,
            data: Array.from(allParticipants.values()),
        });
    } catch (error) {
        console.error('Get participants error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

// Note: GET /merge/:meetingId 已移除 - 请使用 GET /meeting/:meetingId

/**
 * 获取会议完整转录（从预合并的 meeting_transcripts 表查询）
 * GET /api/transcription/meeting/:meetingId
 */
router.get('/meeting/:meetingId', async (req: Request, res: Response) => {
    console.log('');
    console.log('📝 [GET /api/transcription/meeting/:meetingId] 获取会议完整转录');

    try {
        const { meetingId } = req.params;

        if (!meetingId) {
            return res.status(400).json({
                success: false,
                error: 'meetingId is required',
            });
        }

        const db = getDatabase();

        // 从预合并的表查询
        const transcript = db.prepare(`
            SELECT 
                mt.id,
                mt.meeting_id,
                m.title as meeting_title,
                m.started_at,
                m.ended_at,
                mt.full_text,
                mt.segments_json,
                mt.participants_json,
                mt.total_duration_ms,
                mt.total_word_count,
                mt.recording_count,
                mt.completed_count,
                mt.failed_count,
                mt.status,
                mt.error_message,
                mt.updated_at
            FROM meeting_transcripts mt
            JOIN meetings m ON m.id = mt.meeting_id
            WHERE mt.meeting_id = ?
        `).get(meetingId) as {
            id: string;
            meeting_id: string;
            meeting_title: string;
            started_at: number | null;
            ended_at: number | null;
            full_text: string | null;
            segments_json: string | null;
            participants_json: string | null;
            total_duration_ms: number;
            total_word_count: number;
            recording_count: number;
            completed_count: number;
            failed_count: number;
            status: string;
            error_message: string | null;
            updated_at: number;
        } | undefined;

        if (!transcript) {
            return res.status(404).json({
                success: false,
                error: 'No transcription found for this meeting',
            });
        }

        // 解析 JSON 字段
        const segments = transcript.segments_json ? JSON.parse(transcript.segments_json) : [];
        const participants = transcript.participants_json ? JSON.parse(transcript.participants_json) : [];

        console.log(`   📝 会议: ${transcript.meeting_title}`);
        console.log(`   📊 状态: ${transcript.status}, 片段: ${segments.length}, 字数: ${transcript.total_word_count}`);

        return res.json({
            success: true,
            data: {
                meetingId: transcript.meeting_id,
                meetingTitle: transcript.meeting_title,
                startTime: transcript.started_at ? transcript.started_at * 1000 : null,
                endTime: transcript.ended_at,
                fullText: transcript.full_text || '',
                segments,
                participants,
                stats: {
                    totalDurationMs: transcript.total_duration_ms,
                    totalWordCount: transcript.total_word_count,
                    recordingCount: transcript.recording_count,
                    completedCount: transcript.completed_count,
                    failedCount: transcript.failed_count,
                },
                status: transcript.status,
                errorMessage: transcript.error_message,
                updatedAt: transcript.updated_at,
            },
        });
    } catch (error) {
        console.error('Get meeting transcription error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 格式化时间（毫秒 -> HH:MM:SS）
 */
function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * 下载会议转录文本（从预合并的 meeting_transcripts 表查询）
 * GET /api/transcription/meeting/:meetingId/download
 */
router.get('/meeting/:meetingId/download', async (req: Request, res: Response) => {
    console.log('');
    console.log('📥 [GET /api/transcription/meeting/:meetingId/download] 下载转录');

    try {
        const { meetingId } = req.params;
        const format = (req.query.format as string) || 'txt';

        if (!meetingId) {
            return res.status(400).json({
                success: false,
                error: 'meetingId is required',
            });
        }

        const db = getDatabase();

        // 从预合并的表查询
        const transcript = db.prepare(`
            SELECT 
                mt.full_text,
                mt.segments_json,
                mt.participants_json,
                m.title as meeting_title,
                m.started_at,
                m.ended_at
            FROM meeting_transcripts mt
            JOIN meetings m ON m.id = mt.meeting_id
            WHERE mt.meeting_id = ? AND mt.status = 'completed'
        `).get(meetingId) as {
            full_text: string | null;
            segments_json: string | null;
            participants_json: string | null;
            meeting_title: string;
            started_at: number | null;
            ended_at: number | null;
        } | undefined;

        if (!transcript) {
            return res.status(404).json({
                success: false,
                error: 'No transcription found for this meeting',
            });
        }

        const segments = transcript.segments_json ? JSON.parse(transcript.segments_json) : [];
        const participants = transcript.participants_json ? JSON.parse(transcript.participants_json) : [];

        console.log(`   📝 会议: ${transcript.meeting_title}`);
        console.log(`   📊 片段数: ${segments.length}`);

        if (format === 'json') {
            // JSON 格式
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="transcription_${meetingId}.json"`);
            return res.json({
                meetingId,
                meetingTitle: transcript.meeting_title,
                startTime: transcript.started_at ? transcript.started_at * 1000 : null,
                endTime: transcript.ended_at,
                participants,
                segments,
            });
        } else {
            // TXT 格式（默认）
            let txtContent = `会议转录: ${transcript.meeting_title}\n`;
            txtContent += `会议 ID: ${meetingId}\n`;
            txtContent += `参与者: ${participants.map((p: { userName: string }) => p.userName).join(', ')}\n`;
            txtContent += `${'='.repeat(50)}\n\n`;
            txtContent += transcript.full_text || '';

            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="transcription_${meetingId}.txt"`);
            return res.send(txtContent);
        }
    } catch (error) {
        console.error('Download transcription error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

// Note: GET /task/:taskId 已移除 - 任务状态由 Worker 管理，前端通过 /list 接口查询

export default router;
