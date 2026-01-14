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
        const { roomId, memberCount = 1, userId, meetingTitle, subscribeUserIds } = req.body;

        if (!roomId) {
            console.log('   ❌ 缺少 roomId 参数');
            return res.status(400).json({
                success: false,
                error: 'roomId is required',
            });
        }

        console.log(`   🏠 房间: ${roomId}, 成员数: ${memberCount}`);
        console.log(`   👥 订阅用户: ${subscribeUserIds ? subscribeUserIds.join(', ') : '未指定'}`);

        // 为录制机器人生成 UserSig
        const recordUserId = `recorder_${roomId}_${Date.now()}`;
        const userSig = generateUserSig(recordUserId);
        console.log(`   🤖 录制用户: ${recordUserId}`);

        // 根据人数决定录制模式：1人用单流，多人用混流
        const useMixStream = memberCount > 1;
        console.log(`   📹 录制模式: ${useMixStream ? '混流录制' : '单流录制'}`);

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
            });
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
                   r.duration, r.status, r.visibility, r.file_url, r.title,
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
        } else if (trtcResult.data) {
            // 根据 TRTC 返回的状态判断
            const trtcStatus = trtcResult.data.Status;
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

            // 尝试从 TRTC 结果中提取 .m3u8 文件 Key
            if (trtcResult.fileList && trtcResult.fileList.length > 0) {
                const m3u8File = trtcResult.fileList.find(f => f.fileName.endsWith('.m3u8'));
                if (m3u8File) {
                    // Key 格式: meeting/room_{roomId}/{fileName}
                    // 注意：这里假设 meeting_id 就是 room_id (整数的字符串形式)
                    cosFileKey = `meeting/room_${recording.meeting_id}/${m3u8File.fileName}`;
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
            trtcResponse: trtcResult.data,
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
