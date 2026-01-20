// 智会后端 - 转录 API 路由

import { Router, Request, Response } from 'express';
import transcriptionService from '../services/transcription';
import { getDatabase } from '../db';
import { getFileUrl, parseUserIdFromFilename, listFiles } from '../utils/cos';

const router = Router();

/**
 * 获取所有会议的转录列表
 * GET /api/transcription/list
 * 注意: 此路由必须放在 /:id 之前，否则 list 会被当作 id 处理
 * 
 * 前端应该信任 Worker 的工作结果，直接读取 transcription_tasks 表的状态
 */
router.get('/list', async (req: Request, res: Response) => {
    console.log('');
    console.log('📋 [GET /api/transcription/list] 获取转录列表');

    try {
        const db = getDatabase();

        // 获取所有有录制的会议及其转录任务状态
        // 使用 transcription_tasks 表的 status 作为真实状态来源
        const meetings = db.prepare(`
            SELECT 
                m.id as meetingId,
                m.title as meetingTitle,
                m.started_at as startedAt,
                m.ended_at as endedAt,
                COUNT(DISTINCT r.id) as recordingCount,
                tt.status as taskStatus,
                tt.completed_at as taskCompletedAt,
                tt.error_message as taskError
            FROM meetings m
            INNER JOIN recordings r ON r.meeting_id = m.id AND r.status = 'completed'
            LEFT JOIN transcription_tasks tt ON tt.meeting_id = m.id
            WHERE m.status = 'ended'
            GROUP BY m.id
            ORDER BY m.ended_at DESC
            LIMIT 100
        `).all() as Array<{
            meetingId: string;
            meetingTitle: string;
            startedAt: number | null;
            endedAt: number | null;
            recordingCount: number;
            taskStatus: string | null;
            taskCompletedAt: number | null;
            taskError: string | null;
        }>;

        // 映射任务状态到前端状态
        const result = meetings.map(m => {
            // 将 Worker 的任务状态映射到前端状态
            // Worker 状态: pending, submitting, polling, completed, failed
            let transcriptionStatus: 'none' | 'processing' | 'completed' | 'failed' = 'none';

            if (m.taskStatus === 'completed') {
                transcriptionStatus = 'completed';
            } else if (m.taskStatus === 'submitting' || m.taskStatus === 'polling' ||
                m.taskStatus === 'processing' || m.taskStatus === 'pending') {
                transcriptionStatus = 'processing';
            } else if (m.taskStatus === 'failed') {
                transcriptionStatus = 'failed';
            }
            // 如果没有任务状态（taskStatus 为 null），则为 'none'

            return {
                meetingId: m.meetingId,
                meetingTitle: m.meetingTitle,
                startedAt: m.startedAt,
                endedAt: m.endedAt,
                recordingCount: m.recordingCount,
                transcriptionStatus,
                lastTranscriptAt: m.taskCompletedAt,
                taskError: m.taskError,
            };
        });

        console.log(`   ✅ 返回 ${result.length} 个会议`);

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
 * 手动触发会议转录
 * POST /api/transcription/trigger
 * 
 * 只负责将转录任务添加到队列，实际的 COS 扫描和转录由独立 Worker 服务完成
 */
router.post('/trigger', async (req: Request, res: Response) => {
    console.log('');
    console.log('🎯 [POST /api/transcription/trigger] 手动触发转录');

    try {
        const { meetingId } = req.body;

        if (!meetingId) {
            return res.status(400).json({
                success: false,
                error: 'meetingId is required',
            });
        }

        // 检查会议是否存在
        const db = getDatabase();
        const meeting = db.prepare(`
            SELECT id, title, status FROM meetings WHERE id = ?
        `).get(meetingId) as { id: string; title: string; status: string } | undefined;

        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found',
            });
        }

        console.log(`   📋 会议: ${meeting.title} (${meetingId})`);

        // 检查是否已有待处理或进行中的任务
        const existing = db.prepare(`
            SELECT id FROM transcription_tasks 
            WHERE meeting_id = ? AND status IN ('pending', 'submitting', 'polling', 'processing')
        `).get(meetingId) as { id: number } | undefined;

        let taskId: number;
        if (existing) {
            console.log(`   ⚠️ 会议 ${meetingId} 已有转录任务`);
            taskId = existing.id;
        } else {
            // 创建新任务
            const result = db.prepare(`
                INSERT INTO transcription_tasks (meeting_id, status, created_at)
                VALUES (?, 'pending', strftime('%s', 'now'))
            `).run(meetingId);
            taskId = result.lastInsertRowid as number;
            console.log(`   ✅ 已添加转录任务: TaskID=${taskId}`);
        }

        return res.json({
            success: true,
            data: {
                taskId,
                meetingId,
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
 * 获取会议完整转录（别名，方便前端调用）
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

        const result = await transcriptionService.getMeetingTranscription(meetingId);

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'No transcription found for this meeting',
            });
        }

        return res.json({
            success: true,
            data: result,
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
 * 下载会议转录文本
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

        // 获取会议完整转录
        const transcript = await transcriptionService.getMeetingTranscription(meetingId);

        if (!transcript) {
            return res.status(404).json({
                success: false,
                error: 'No transcription found for this meeting',
            });
        }

        console.log(`   📝 会议: ${transcript.meetingTitle}`);
        console.log(`   📊 片段数: ${transcript.segments.length}`);

        if (format === 'json') {
            // JSON 格式
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="transcription_${meetingId}.json"`);
            return res.json({
                meetingId: transcript.meetingId,
                meetingTitle: transcript.meetingTitle,
                startTime: transcript.startTime,
                endTime: transcript.endTime,
                participants: transcript.participants,
                segments: transcript.segments,
            });
        } else {
            // TXT 格式（默认）
            let txtContent = `会议转录: ${transcript.meetingTitle}\n`;
            txtContent += `会议 ID: ${meetingId}\n`;
            txtContent += `参与者: ${transcript.participants.map(p => p.userName).join(', ')}\n`;
            txtContent += `${'='.repeat(50)}\n\n`;
            txtContent += transcript.fullText;

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
