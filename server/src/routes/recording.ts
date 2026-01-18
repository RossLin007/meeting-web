// 智会后端 - 录制 API 路由

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { generateUserSig } from '../utils/userSig';
import recordingService from '../services/recording';
import { getDatabase } from '../db';
import { getFileUrl } from '../utils/cos';

const router = Router();

const SDK_APP_ID = Number(process.env.TRTC_SDK_APP_ID) || 20032332;

/**
 * 启动录制
 * POST /api/recording/start
 */
router.post('/start', async (req: Request, res: Response) => {
    console.log('');
    console.log('🎥 [POST /api/recording/start] 收到录制启动请求');
    console.log('   请求体:', JSON.stringify(req.body, null, 2));

    try {
        const { roomId, memberCount = 1, userId, meetingTitle, subscribeUserIds, recordMode = 'auto', members } = req.body;

        if (!roomId) {
            console.log('   ❌ 缺少 roomId 参数');
            return res.status(400).json({
                success: false,
                error: 'roomId is required',
            });
        }

        console.log(`   🏠 房间: ${roomId}, 成员数: ${memberCount}`);
        console.log(`   👥 订阅用户: ${subscribeUserIds ? subscribeUserIds.join(', ') : '未指定'}`);
        console.log(`   📹 录制模式请求: ${recordMode}`);

        // 为录制机器人生成 UserSig
        const recordUserId = `recorder_${roomId}_${Date.now()}`;
        const userSig = generateUserSig(recordUserId);
        console.log(`   🤖 录制用户: ${recordUserId}`);

        // 决定录制模式：默认使用单流录制（每人一个文件，100% 说话人准确）
        let useMixStream: boolean;
        let finalRecordMode: 'mixed' | 'single';

        if (recordMode === 'single') {
            useMixStream = false;
            finalRecordMode = 'single';
        } else if (recordMode === 'mixed') {
            useMixStream = true;
            finalRecordMode = 'mixed';
        } else {
            // auto: 默认使用单流录制（改进：100% 说话人识别准确率）
            useMixStream = false;
            finalRecordMode = 'single';
        }
        console.log(`   📹 最终录制模式: ${finalRecordMode} (useMixStream=${useMixStream})`);

        // 如果没有指定订阅用户列表，使用 userId（如果提供的话）
        const finalSubscribeUserIds = subscribeUserIds || (userId ? [userId] : undefined);

        const result = await recordingService.startCloudRecording({
            sdkAppId: SDK_APP_ID,
            roomId: Number(roomId),
            recordUserId,
            userSig,
            useMixStream,
            subscribeUserIds: finalSubscribeUserIds,
        });

        // 保存录制记录到数据库
        if (result.success && result.taskId) {
            const recordingId = uuidv4();
            await recordingService.saveRecordingToDB({
                id: recordingId,
                meetingId: String(roomId),
                taskId: result.taskId,
                startedBy: userId || 'unknown',
                title: meetingTitle || '会议录制',
                recordMode: finalRecordMode,
            });

            // 单流录制模式：为每个参与者创建子录制记录（用于后续转录关联）
            if (finalRecordMode === 'single' && members && members.length > 0) {
                console.log(`   🔗 单流模式：记录 ${members.length} 个参与者信息`);
                for (const member of members) {
                    const childRecordingId = uuidv4();
                    await recordingService.saveRecordingToDB({
                        id: childRecordingId,
                        meetingId: String(roomId),
                        taskId: result.taskId,
                        startedBy: userId || 'unknown',
                        title: `${member.userName || member.userId} 的录制`,
                        recordMode: 'single',
                        userId: member.userId,
                        userName: member.userName,
                        parentId: recordingId,
                    });
                    console.log(`      - ${member.userName || member.userId}`);
                }
            }
        }

        console.log('   📤 返回结果:', JSON.stringify(result));
        return res.json(result);
    } catch (error) {
        console.error('   ❌ Start recording error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 从 COS 文件创建录制记录（用于转录）
 * POST /api/recording/create-from-file
 */
router.post('/create-from-file', async (req: Request, res: Response) => {
    console.log('');
    console.log('📁 [POST /api/recording/create-from-file] 从文件创建录制记录');

    try {
        const { cosFileKey, fileName, fileUrl } = req.body;

        if (!cosFileKey) {
            return res.status(400).json({
                success: false,
                error: 'cosFileKey is required',
            });
        }

        const db = getDatabase();

        // 检查是否已存在该文件的录制记录
        const existing = db.prepare(`
            SELECT id FROM recordings WHERE cos_file_key = ?
        `).get(cosFileKey) as { id: string } | undefined;

        if (existing) {
            console.log(`   ✅ 已存在录制记录: ${existing.id}`);
            return res.json({
                success: true,
                recordingId: existing.id,
                existing: true,
            });
        }

        // 确保系统会议 'file-upload' 存在（用于从文件创建的录制）
        const systemMeetingExists = db.prepare(`
            SELECT id FROM meetings WHERE id = 'file-upload'
        `).get();

        if (!systemMeetingExists) {
            db.prepare(`
                INSERT INTO meetings (id, title, created_by, host_id, status)
                VALUES ('file-upload', '文件上传', 'system', 'system', 'ended')
            `).run();
            console.log('   📝 创建系统会议 file-upload');
        }

        // 创建新记录
        const recordingId = uuidv4();
        const now = Math.floor(Date.now() / 1000);

        // 如果没有传入 fileUrl，从 COS key 生成签名 URL
        let finalFileUrl = fileUrl;
        if (!finalFileUrl) {
            finalFileUrl = await getFileUrl(cosFileKey);
        }

        db.prepare(`
            INSERT INTO recordings (id, meeting_id, task_id, started_by, started_at, status, visibility, file_url, cos_file_key, title)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            recordingId,
            'file-upload',  // 系统会议 ID
            null,           // 无 TRTC task_id
            'system',
            now,
            'completed',
            'host_only',
            finalFileUrl,
            cosFileKey,
            fileName || cosFileKey
        );

        console.log(`   ✅ 创建录制记录: ${recordingId}`);

        return res.json({
            success: true,
            recordingId,
            existing: false,
        });
    } catch (error) {
        console.error('Create recording from file error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 停止录制
 * POST /api/recording/stop
 */
router.post('/stop', async (req: Request, res: Response) => {
    console.log('');
    console.log('🛑 [POST /api/recording/stop] 收到停止录制请求');

    try {
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                error: 'roomId is required',
            });
        }

        // 先获取当前录制状态（包含 taskId）
        const status = await recordingService.getRecordingStatus(SDK_APP_ID, Number(roomId));

        const result = await recordingService.stopCloudRecording({
            sdkAppId: SDK_APP_ID,
            roomId: Number(roomId),
        });

        // 更新数据库记录
        if (result.success && result.taskId) {
            await recordingService.updateRecordingInDB({
                taskId: result.taskId,
                status: 'completed',
                duration: status.duration,
            });
        }

        console.log('   📤 返回结果:', JSON.stringify(result));
        return res.json(result);
    } catch (error) {
        console.error('Stop recording error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取录制状态（实时）
 * GET /api/recording/status/:roomId
 */
router.get('/status/:roomId', async (req: Request, res: Response) => {
    try {
        const { roomId } = req.params;

        const result = await recordingService.getRecordingStatus(
            SDK_APP_ID,
            Number(roomId)
        );

        return res.json(result);
    } catch (error) {
        console.error('Get recording status error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取用户所有可见的录制列表
 * GET /api/recording/list/all
 */
router.get('/list/all', async (req: Request, res: Response) => {
    try {
        const userId = req.query.userId as string;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        const db = getDatabase();

        // 获取用户作为主持人的所有会议的录制
        const recordings = db.prepare(`
            SELECT r.id, r.task_id, r.started_by, r.started_at, r.ended_at,
                   r.duration, r.status, r.visibility, r.file_url, r.title, r.cos_file_key,
                   m.title as meeting_title, m.id as meeting_id
            FROM recordings r
            JOIN meetings m ON r.meeting_id = m.id
            WHERE m.host_id = ? OR (r.visibility = 'all' AND EXISTS (
                SELECT 1 FROM meeting_members mm 
                WHERE mm.meeting_id = r.meeting_id AND mm.user_id = ?
            ))
            ORDER BY r.started_at DESC
            LIMIT 50
        `).all(userId, userId) as Array<{
            id: string;
            task_id: string;
            started_by: string;
            started_at: number;
            ended_at: number | null;
            duration: number | null;
            status: string;
            visibility: string;
            file_url: string | null;
            title: string | null;
            cos_file_key: string | null;
            meeting_title: string;
            meeting_id: string;
        }>;

        const recordingsWithUrl = await Promise.all(recordings.map(async r => {
            let fileUrl = r.file_url;
            // 如果有 COS Key，生成签名 URL
            if (r['cos_file_key']) {
                try {
                    fileUrl = await getFileUrl(r['cos_file_key'] as string);
                } catch (e) {
                    console.error('Sign URL failed for', r.id, e);
                }
            }
            return {
                id: r.id,
                taskId: r.task_id,
                startedBy: r.started_by,
                startedAt: r.started_at,
                endedAt: r.ended_at,
                duration: r.duration,
                status: r.status,
                visibility: r.visibility,
                fileUrl: fileUrl,
                title: r.title || r.meeting_title,
                meetingId: r.meeting_id,
            };
        }));

        return res.json({
            success: true,
            data: recordingsWithUrl,
            isHost: true,
        });
    } catch (error) {
        console.error('Get all recordings error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取会议的录制列表
 * GET /api/recording/list/:meetingId
 */
router.get('/list/:meetingId', async (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const userId = req.query.userId as string;

        if (!meetingId || !userId) {
            return res.status(400).json({
                success: false,
                error: 'meetingId and userId are required',
            });
        }

        // 检查用户是否是主持人
        const db = getDatabase();
        const meeting = db.prepare(`
            SELECT host_id FROM meetings WHERE id = ?
        `).get(meetingId) as { host_id: string } | undefined;

        const isHost = meeting?.host_id === userId;

        const recordings = await recordingService.getRecordingsByMeeting(
            meetingId,
            userId,
            isHost
        );

        // 为录制列表生成签名 URL
        const recordingsWithUrl = await Promise.all(recordings.map(async r => {
            let fileUrl = r.fileUrl;
            if (r.cosFileKey) {
                try {
                    fileUrl = await getFileUrl(r.cosFileKey);
                } catch (e) {
                    console.error('Sign URL failed for', r.id, e);
                }
            }
            return {
                ...r,
                fileUrl,
            };
        }));

        return res.json({
            success: true,
            data: recordingsWithUrl,
            isHost,
        });
    } catch (error) {
        console.error('Get recording list error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 更新录制可见性
 * PUT /api/recording/:id/visibility
 */
router.put('/:id/visibility', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { visibility, userId } = req.body;

        if (!id || !visibility || !userId) {
            return res.status(400).json({
                success: false,
                error: 'id, visibility, and userId are required',
            });
        }

        if (visibility !== 'host_only' && visibility !== 'all') {
            return res.status(400).json({
                success: false,
                error: 'visibility must be "host_only" or "all"',
            });
        }

        const result = await recordingService.updateRecordingVisibility(id, visibility, userId);
        return res.json(result);
    } catch (error) {
        console.error('Update recording visibility error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 查询 TRTC 录制任务状态（调试用）
 * GET /api/recording/task/:taskId
 */
router.get('/task/:taskId', async (req: Request, res: Response) => {
    try {
        const { taskId } = req.params;

        const result = await recordingService.describeCloudRecording(SDK_APP_ID, taskId);
        return res.json(result);
    } catch (error) {
        console.error('Describe recording task error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 同步录制状态 - 从 TRTC API 查询真实状态并更新数据库
 * POST /api/recording/:id/sync
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        const db = getDatabase();

        // 获取录制信息
        const recording = db.prepare(`
            SELECT r.*, m.host_id, m.id as meeting_id
            FROM recordings r
            JOIN meetings m ON r.meeting_id = m.id
            WHERE r.id = ?
        `).get(id) as {
            host_id: string;
            task_id: string;
            started_at: number;
            status: string;
            meeting_id: string;
        } | undefined;

        if (!recording) {
            return res.status(404).json({
                success: false,
                error: 'Recording not found',
            });
        }

        if (recording.host_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only host can sync recording status',
            });
        }

        // 如果已经不是"录制中"状态，无需同步
        if (recording.status !== 'recording') {
            return res.json({
                success: true,
                message: 'Recording is not in recording status, no sync needed',
                status: recording.status,
            });
        }

        // 调用 TRTC API 查询真实状态
        console.log(`🔄 同步录制状态: ${id}, taskId: ${recording.task_id}`);
        const trtcResult = await recordingService.describeCloudRecording(SDK_APP_ID, recording.task_id);

        let newStatus: 'recording' | 'completed' | 'failed' = 'recording';
        let message = '';

        if (!trtcResult.success) {
            // TRTC 查询失败，可能是录制已结束（任务不存在）
            // 如果错误消息包含"不存在"或类似内容，标记为已完成
            if (trtcResult.error?.includes('not exist') ||
                trtcResult.error?.includes('不存在') ||
                trtcResult.error?.includes('ResourceNotFound')) {
                newStatus = 'completed';
                message = '录制任务已结束（TRTC 返回任务不存在）';
            } else {
                newStatus = 'failed';
                message = `查询失败: ${trtcResult.error}`;
            }
        } else if (trtcResult.status) {
            // 根据 TRTC 返回的状态判断
            const trtcStatus = trtcResult.status;
            if (trtcStatus === 'stopped' || trtcStatus === 'finished') {
                newStatus = 'completed';
                message = `TRTC 状态: ${trtcStatus}`;
            } else if (trtcStatus === 'failed' || trtcStatus === 'error') {
                newStatus = 'failed';
                message = `TRTC 状态: ${trtcStatus}`;
            } else {
                // 还在录制中
                newStatus = 'recording';
                message = `TRTC 状态: ${trtcStatus}，仍在录制中`;
            }
        }

        // 如果状态需要更新
        if (newStatus !== 'recording') {
            const now = Math.floor(Date.now() / 1000);
            const duration = now - recording.started_at;

            let cosFileKey: string | null = null;

            // 尝试从 TRTC 结果中提取录制文件 Key
            // 优先使用 .mp4 文件（转录需要），其次用 .m3u8
            if (trtcResult.fileList && trtcResult.fileList.length > 0) {
                // 优先查找 MP4 文件（用于转录）
                let targetFile = trtcResult.fileList.find(f => f.fileName.endsWith('.mp4'));
                // 如果没有 MP4，使用 m3u8
                if (!targetFile) {
                    targetFile = trtcResult.fileList.find(f => f.fileName.endsWith('.m3u8'));
                }

                if (targetFile) {
                    // Key 格式: meeting/room_{roomId}/{taskId}/{fileName}
                    // 注意：需要包含 taskId 子目录
                    cosFileKey = `meeting/room_${recording.meeting_id}/${recording.task_id}/${targetFile.fileName}`;
                    console.log(`🎥 找到录制文件: ${cosFileKey}`);
                }
            }

            db.prepare(`
                UPDATE recordings
                SET status = ?, ended_at = ?, duration = ?, cos_file_key = ?
                WHERE id = ?
            `).run(newStatus, now, duration, cosFileKey, id);

            console.log(`✅ 录制状态已更新: ${id} -> ${newStatus}`);
        }

        return res.json({
            success: true,
            status: newStatus,
            message,
            trtcResponse: { status: trtcResult.status, fileList: trtcResult.fileList },
        });
    } catch (error) {
        console.error('Sync recording status error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 手动更新录制状态（处理遗留的"录制中"状态）
 * PUT /api/recording/:id/status
 */
router.put('/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status, userId } = req.body;

        if (!status || !['completed', 'failed'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'status must be "completed" or "failed"',
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        const db = getDatabase();

        // 验证用户权限（必须是录制所属会议的主持人）
        const recording = db.prepare(`
            SELECT r.*, m.host_id
            FROM recordings r
            JOIN meetings m ON r.meeting_id = m.id
            WHERE r.id = ?
        `).get(id) as { host_id: string; task_id: string; started_at: number } | undefined;

        if (!recording) {
            return res.status(404).json({
                success: false,
                error: 'Recording not found',
            });
        }

        if (recording.host_id !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only host can update recording status',
            });
        }

        // 计算时长
        const now = Math.floor(Date.now() / 1000);
        const duration = now - recording.started_at;

        // 更新状态
        db.prepare(`
            UPDATE recordings
            SET status = ?, ended_at = ?, duration = ?
            WHERE id = ?
        `).run(status, now, duration, id);

        console.log(`📝 手动更新录制状态: ${id} -> ${status}`);

        return res.json({
            success: true,
            message: `Recording status updated to ${status}`,
        });
    } catch (error) {
        console.error('Update recording status error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

export default router;
