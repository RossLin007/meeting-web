// 智会后端 - 转录 API 路由

import { Router, Request, Response } from 'express';
import transcriptionService from '../services/transcription';
import { getDatabase } from '../db';
import { getFileUrl, parseUserIdFromFilename } from '../utils/cos';

const router = Router();

/**
 * 开始转录
 * POST /api/transcription/start
 */
router.post('/start', async (req: Request, res: Response) => {
    console.log('');
    console.log('🎤 [POST /api/transcription/start] 收到转录请求');

    try {
        const { recordingId, speakerCount } = req.body;

        if (!recordingId) {
            return res.status(400).json({
                success: false,
                error: 'recordingId is required',
            });
        }

        // 获取录制信息
        const db = getDatabase();
        const recording = db.prepare(`
            SELECT id, file_url, cos_file_key, status, meeting_id, task_id FROM recordings WHERE id = ?
        `).get(recordingId) as {
            id: string;
            file_url: string | null;
            cos_file_key: string | null;
            status: string;
            meeting_id: string | null;
            task_id: string | null;
        } | undefined;

        if (!recording) {
            return res.status(404).json({
                success: false,
                error: 'Recording not found',
            });
        }

        // 检查是否已有转录任务
        const existingTranscription = await transcriptionService.getTranscriptionByRecordingId(recordingId);
        if (existingTranscription && existingTranscription.status !== 'failed') {
            return res.json({
                success: true,
                transcriptionId: existingTranscription.id,
                status: existingTranscription.status,
                message: 'Transcription already exists',
            });
        }

        // 构建带签名的文件 URL
        let fileUrl = recording.file_url;
        let cosKey: string | null = null;

        console.log(`   📋 录制信息: file_url=${recording.file_url ? '有' : '无'}, cos_file_key=${recording.cos_file_key || '无'}`);

        // 使用已保存的 COS 文件 key
        if (recording.cos_file_key) {
            cosKey = recording.cos_file_key;
        }
        // 注意：不再回退到推断文件路径，因为单流录制的文件名格式与混流不同

        // 如果有 COS key 但没有 fileUrl，生成带签名的 URL
        if (!fileUrl && cosKey) {
            try {
                fileUrl = await getFileUrl(cosKey, 7200);
                console.log(`   ✅ 从 cos_file_key 生成签名 URL 成功`);
            } catch (err) {
                console.error('   ❌ 生成签名 URL 失败:', err);
            }
        }

        // 如果还是没有 fileUrl，提供更详细的错误信息
        if (!fileUrl) {
            console.log(`   ❌ 无法获取文件 URL: file_url=${recording.file_url}, cos_file_key=${recording.cos_file_key}`);
            console.log(`   💡 提示: 请从"我的录制"页面重新点击转录按钮，或确保录制同步后有正确的 cos_file_key`);
            return res.status(400).json({
                success: false,
                error: `录制文件 URL 不可用。请从"我的录制"页面重新发起转录，或同步录制状态后重试。`,
                details: {
                    hasFileUrl: !!recording.file_url,
                    hasCosFileKey: !!recording.cos_file_key,
                }
            });
        }

        console.log(`   📁 录制ID: ${recordingId}`);
        console.log(`   🔗 文件URL: ${fileUrl}`);

        // 提交转录任务
        const submitResult = await transcriptionService.submitTranscription(fileUrl, speakerCount);

        if (!submitResult.success || !submitResult.taskId) {
            return res.status(500).json({
                success: false,
                error: submitResult.error || 'Failed to submit transcription task',
            });
        }

        // 创建转录记录
        const transcriptionId = await transcriptionService.createTranscriptionRecord(
            recordingId,
            submitResult.taskId
        );

        // 更新状态为处理中
        await transcriptionService.updateTranscriptionStatus(transcriptionId, 'processing');

        console.log('   ✅ 转录任务已创建');
        console.log(`   ID: ${transcriptionId}`);

        return res.json({
            success: true,
            transcriptionId,
            taskId: submitResult.taskId,
            status: 'processing',
        });
    } catch (error) {
        console.error('Start transcription error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

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

/**
 * 同步转录状态（从阿里云查询并更新）
 * POST /api/transcription/:id/sync
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // 获取转录记录
        const db = getDatabase();
        const transcription = db.prepare(`
            SELECT id, task_id, status, recording_id FROM transcriptions WHERE id = ?
        `).get(id) as { id: string; task_id: string | null; status: string; recording_id: string } | undefined;

        if (!transcription) {
            return res.status(404).json({
                success: false,
                error: 'Transcription not found',
            });
        }

        // 如果已完成或失败，无需同步
        if (transcription.status === 'completed' || transcription.status === 'failed') {
            return res.json({
                success: true,
                status: transcription.status,
                message: 'Transcription already finished',
            });
        }

        if (!transcription.task_id) {
            return res.status(400).json({
                success: false,
                error: 'No task ID associated with this transcription',
            });
        }

        console.log(`🔄 同步转录状态: ${id}`);

        // 查询阿里云任务状态
        const taskResult = await transcriptionService.queryTranscriptionStatus(transcription.task_id);

        if (taskResult.status === 'SUCCEEDED' && taskResult.results && taskResult.results.length > 0) {
            // 下载并解析结果
            const transcriptionUrl = taskResult.results[0].transcriptionUrl;
            const parsedResult = await transcriptionService.parseTranscriptionResult(transcriptionUrl);

            // 保存结果
            await transcriptionService.saveTranscriptionResult(id, parsedResult);

            // 自动关联说话人与会议参与者
            try {
                // 获取录制信息
                const recording = db.prepare(`
                    SELECT meeting_id, cos_file_key, user_id, user_name FROM recordings WHERE id = ?
                `).get(transcription.recording_id) as {
                    meeting_id: string;
                    cos_file_key: string | null;
                    user_id: string | null;
                    user_name: string | null;
                } | undefined;

                // 辅助函数：根据 userId 查找用户名
                const findUserName = (userId: string): string | null => {
                    // 1. 优先从 users 表查找
                    const user = db.prepare(`
                        SELECT name FROM users WHERE id = ?
                    `).get(userId) as { name: string } | undefined;
                    if (user?.name) {
                        console.log(`   ✅ 从 users 表找到用户名: ${user.name}`);
                        return user.name;
                    }

                    // 2. 从 meeting_members 表查找
                    const member = db.prepare(`
                        SELECT user_name FROM meeting_members WHERE user_id = ? LIMIT 1
                    `).get(userId) as { user_name: string } | undefined;
                    if (member?.user_name) {
                        console.log(`   ✅ 从 meeting_members 表找到用户名: ${member.user_name}`);
                        return member.user_name;
                    }

                    // 3. 使用 userId 前 8 位作为显示名
                    const shortId = userId.substring(0, 8);
                    console.log(`   ⚠️ 未找到用户名，使用 userId 前缀: ${shortId}`);
                    return shortId;
                };

                // 方式1: 单流录制 - 从文件名解析 userId
                let singleStreamUserName: string | null = null;

                // 检查录制记录是否已有 user_id/user_name
                if (recording?.user_name) {
                    singleStreamUserName = recording.user_name;
                    console.log(`📌 单流录制: 从录制记录获取用户名 = ${singleStreamUserName}`);
                }
                // 否则从文件名解析
                else if (recording?.cos_file_key) {
                    const parsedUserId = parseUserIdFromFilename(recording.cos_file_key);
                    if (parsedUserId) {
                        console.log(`📌 单流录制: 从文件名解析出 userId = ${parsedUserId}`);
                        singleStreamUserName = findUserName(parsedUserId);

                        // 更新录制记录的 user_id 和 user_name（便于后续使用）
                        if (singleStreamUserName) {
                            db.prepare(`
                                UPDATE recordings SET user_id = ?, user_name = ? WHERE id = ?
                            `).run(parsedUserId, singleStreamUserName, transcription.recording_id);
                            console.log(`   💾 已更新录制记录的用户信息`);
                        }
                    }
                }

                // 如果是单流录制且找到了用户名，所有说话人都归属于该用户
                if (singleStreamUserName) {
                    console.log(`🎯 单流录制: 所有说话人归属于 ${singleStreamUserName}`);
                    for (const speakerId of parsedResult.speakerIds) {
                        await transcriptionService.updateSpeakerLabel(id, speakerId, singleStreamUserName);
                    }
                }
                // 方式2: 混流录制 - 按参与者顺序分配
                else if (recording?.meeting_id && recording.meeting_id !== 'file-upload') {
                    const members = db.prepare(`
                        SELECT DISTINCT user_id, user_name FROM meeting_members 
                        WHERE meeting_id = ?
                        ORDER BY joined_at ASC
                    `).all(recording.meeting_id) as Array<{ user_id: string; user_name: string }>;

                    if (members.length > 0) {
                        console.log(`🔗 混流录制: 自动关联说话人与参与者 (${parsedResult.speakerIds.length} 说话人, ${members.length} 参与者)`);

                        for (let i = 0; i < parsedResult.speakerIds.length; i++) {
                            const speakerId = parsedResult.speakerIds[i];
                            if (i < members.length) {
                                // 优先使用 users 表的名字
                                const userName = findUserName(members[i].user_id) || members[i].user_name;
                                await transcriptionService.updateSpeakerLabel(id, speakerId, userName);
                                console.log(`   说话人 ${speakerId + 1} -> ${userName}`);
                            }
                        }
                    }
                }
            } catch (autoAssignError) {
                console.warn('⚠️ 自动关联说话人失败，使用默认标签:', autoAssignError);
            }

            await transcriptionService.updateTranscriptionStatus(id, 'completed');

            console.log(`✅ 转录已完成: ${id}`);

            return res.json({
                success: true,
                status: 'completed',
                segmentCount: parsedResult.segments.length,
                speakerCount: parsedResult.speakerIds.length,
            });
        } else if (taskResult.status === 'FAILED') {
            await transcriptionService.updateTranscriptionStatus(id, 'failed', taskResult.error);

            return res.json({
                success: true,
                status: 'failed',
                error: taskResult.error,
            });
        } else {
            // 仍在处理中
            return res.json({
                success: true,
                status: 'processing',
                taskStatus: taskResult.status,
            });
        }
    } catch (error) {
        console.error('Sync transcription error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

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

/**
 * 合并会议的所有单流录制转录结果
 * GET /api/transcription/merge/:meetingId
 * 
 * 将同一会议的所有用户录制文件的转录结果合并，
 * 处理时间偏移，按时间顺序排列，生成完整会议记录
 */
router.get('/merge/:meetingId', async (req: Request, res: Response) => {
    console.log('');
    console.log('🔗 [GET /api/transcription/merge/:meetingId] 合并会议转录');

    try {
        const { meetingId } = req.params;

        if (!meetingId) {
            return res.status(400).json({
                success: false,
                error: 'meetingId is required',
            });
        }

        // 使用服务函数获取会议完整转录
        const result = await transcriptionService.getMeetingTranscription(meetingId);

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'No transcription found for this meeting',
            });
        }

        return res.json({
            success: true,
            meetingId: result.meetingId,
            meetingTitle: result.meetingTitle,
            participants: result.participants,
            recordingCount: result.participants.length,
            segmentCount: result.segments.length,
            segments: result.segments,
            fullText: result.fullText,
        });
    } catch (error) {
        console.error('Merge transcriptions error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

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

export default router;
