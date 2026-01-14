// 智会后端 - 会议管理 API 路由

import { Router, Request, Response } from 'express';
import * as meetingStore from '../services/meetingStore';

const router = Router();

/**
 * 创建会议
 * POST /api/meetings
 */
router.post('/', (req: Request, res: Response) => {
    try {
        const { title, password, userId, userName, imGroupId } = req.body;

        if (!title || !userId) {
            return res.status(400).json({
                success: false,
                error: 'title and userId are required',
            });
        }

        const meeting = meetingStore.createMeeting({
            title,
            password,
            createdBy: userId,
            imGroupId,  // 保存 IM 群组 ID
        });

        return res.json({
            success: true,
            data: meeting,
        });
    } catch (error) {
        console.error('Create meeting error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取会议信息
 * GET /api/meetings/:meetingId
 */
router.get('/:meetingId', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const meeting = meetingStore.getMeeting(meetingId);

        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found',
            });
        }

        return res.json({
            success: true,
            data: meeting,
        });
    } catch (error) {
        console.error('Get meeting error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取房间完整状态
 * GET /api/meetings/:meetingId/state
 */
router.get('/:meetingId/state', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const state = meetingStore.getRoomState(meetingId);

        if (!state) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found',
            });
        }

        return res.json({
            success: true,
            data: state,
        });
    } catch (error) {
        console.error('Get room state error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 加入会议
 * POST /api/meetings/:meetingId/join
 */
router.post('/:meetingId/join', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { userId, userName, password } = req.body;

        if (!userId || !userName) {
            return res.status(400).json({
                success: false,
                error: 'userId and userName are required',
            });
        }

        // 检查会议是否存在
        const meeting = meetingStore.getMeeting(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found',
            });
        }

        // 检查密码
        if (meeting.password && meeting.password !== password) {
            return res.status(403).json({
                success: false,
                error: 'Wrong password',
            });
        }

        // 检查会议状态
        if (meeting.status === 'ended') {
            return res.status(400).json({
                success: false,
                error: 'Meeting has ended',
            });
        }

        const member = meetingStore.joinMeeting({
            meetingId,
            userId,
            userName,
        });

        // 返回完整房间状态
        const state = meetingStore.getRoomState(meetingId);

        return res.json({
            success: true,
            data: {
                member,
                roomState: state,
            },
        });
    } catch (error) {
        console.error('Join meeting error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 离开会议
 * POST /api/meetings/:meetingId/leave
 */
router.post('/:meetingId/leave', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        meetingStore.leaveMeeting(meetingId, userId);

        return res.json({
            success: true,
        });
    } catch (error) {
        console.error('Leave meeting error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 结束会议（仅主持人）
 * POST /api/meetings/:meetingId/end
 */
router.post('/:meetingId/end', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { userId } = req.body;

        const meeting = meetingStore.getMeeting(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found',
            });
        }

        // 检查是否是主持人
        if (meeting.hostId !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only host can end meeting',
            });
        }

        meetingStore.updateMeetingStatus(meetingId, 'ended');
        meetingStore.logMeetingEvent(meetingId, userId, 'meeting.ended');

        return res.json({
            success: true,
        });
    } catch (error) {
        console.error('End meeting error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取成员列表
 * GET /api/meetings/:meetingId/members
 */
router.get('/:meetingId/members', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const members = meetingStore.getOnlineMembers(meetingId);

        return res.json({
            success: true,
            data: members,
        });
    } catch (error) {
        console.error('Get members error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 更新成员状态（静音/摄像头）
 * PUT /api/meetings/:meetingId/members/:userId
 */
router.put('/:meetingId/members/:userId', (req: Request, res: Response) => {
    try {
        const { meetingId, userId } = req.params;
        const { operatorId, isMuted, isCameraOff } = req.body;

        if (!operatorId) {
            return res.status(400).json({
                success: false,
                error: 'operatorId is required',
            });
        }

        // 检查操作权限（主持人或联席主持人）
        const meeting = meetingStore.getMeeting(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found',
            });
        }

        const members = meetingStore.getOnlineMembers(meetingId);
        const operator = members.find(m => m.userId === operatorId);
        if (!operator || (operator.role !== 'host' && operator.role !== 'cohost')) {
            return res.status(403).json({
                success: false,
                error: 'Only host or cohost can update member status',
            });
        }

        meetingStore.updateMemberStatus(meetingId, userId, { isMuted, isCameraOff }, operatorId);

        return res.json({
            success: true,
        });
    } catch (error) {
        console.error('Update member error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 转移主持人
 * POST /api/meetings/:meetingId/host
 */
router.post('/:meetingId/host', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { operatorId, newHostId } = req.body;

        if (!operatorId || !newHostId) {
            return res.status(400).json({
                success: false,
                error: 'operatorId and newHostId are required',
            });
        }

        const meeting = meetingStore.getMeeting(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found',
            });
        }

        if (meeting.hostId !== operatorId) {
            return res.status(403).json({
                success: false,
                error: 'Only host can transfer host',
            });
        }

        meetingStore.transferHost(meetingId, newHostId, operatorId);

        return res.json({
            success: true,
        });
    } catch (error) {
        console.error('Transfer host error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 开始录制（仅主持人）
 * POST /api/meetings/:meetingId/recording/start
 */
router.post('/:meetingId/recording/start', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { userId, taskId } = req.body;

        if (!userId || !taskId) {
            return res.status(400).json({
                success: false,
                error: 'userId and taskId are required',
            });
        }

        const meeting = meetingStore.getMeeting(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found',
            });
        }

        // 检查是否已有录制进行中
        const currentRecording = meetingStore.getCurrentRecording(meetingId);
        if (currentRecording) {
            return res.status(400).json({
                success: false,
                error: 'Recording already in progress',
            });
        }

        // 检查是否是主持人
        const members = meetingStore.getOnlineMembers(meetingId);
        const member = members.find(m => m.userId === userId);
        if (!member || (member.role !== 'host' && member.role !== 'cohost')) {
            return res.status(403).json({
                success: false,
                error: 'Only host or cohost can start recording',
            });
        }

        const recording = meetingStore.startRecording(meetingId, userId, taskId);

        return res.json({
            success: true,
            data: recording,
        });
    } catch (error) {
        console.error('Start recording error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 停止录制
 * POST /api/meetings/:meetingId/recording/stop
 */
router.post('/:meetingId/recording/stop', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { userId, taskId, fileUrl, fileSize } = req.body;

        if (!userId || !taskId) {
            return res.status(400).json({
                success: false,
                error: 'userId and taskId are required',
            });
        }

        const meeting = meetingStore.getMeeting(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found',
            });
        }

        // 检查是否是主持人
        const members = meetingStore.getOnlineMembers(meetingId);
        const member = members.find(m => m.userId === userId);
        if (!member || (member.role !== 'host' && member.role !== 'cohost')) {
            return res.status(403).json({
                success: false,
                error: 'Only host or cohost can stop recording',
            });
        }

        meetingStore.stopRecording(taskId, userId, fileUrl, fileSize);

        return res.json({
            success: true,
        });
    } catch (error) {
        console.error('Stop recording error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取聊天历史
 * GET /api/meetings/:meetingId/messages
 */
router.get('/:meetingId/messages', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const limit = parseInt(req.query.limit as string) || 100;

        const messages = meetingStore.getChatMessages(meetingId, limit);

        return res.json({
            success: true,
            data: messages,
        });
    } catch (error) {
        console.error('Get messages error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 保存聊天消息
 * POST /api/meetings/:meetingId/messages
 */
router.post('/:meetingId/messages', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { senderId, senderName, content, type, fileUrl } = req.body;

        if (!senderId || !senderName || !content) {
            return res.status(400).json({
                success: false,
                error: 'senderId, senderName and content are required',
            });
        }

        const message = meetingStore.saveChatMessage({
            meetingId,
            senderId,
            senderName,
            content,
            type,
            fileUrl,
        });

        return res.json({
            success: true,
            data: message,
        });
    } catch (error) {
        console.error('Save message error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

// ========== IM 群组管理 API ==========

/**
 * 获取或创建 IM 群组（幂等操作）
 * POST /api/meetings/:meetingId/im-group
 *
 * 说明：
 * - 如果会议不存在，自动创建
 * - 如果群组已存在，直接返回 imGroupId
 * - 如果群组不存在，返回需要创建的标志
 */
router.post('/:meetingId/im-group', async (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        // 检查会议是否存在
        const meeting = meetingStore.getMeeting(meetingId);
        if (!meeting) {
            console.log(`❌ 会议不存在: ${meetingId}，需要先创建会议`);
            return res.status(404).json({
                success: false,
                error: 'Meeting not found. Please create the meeting first.',
                code: 'MEETING_NOT_FOUND',
            });
        }

        // 如果已有 imGroupId，直接返回
        if (meeting.imGroupId) {
            console.log(`✅ 群组已存在: ${meeting.imGroupId}`);
            return res.json({
                success: true,
                data: {
                    imGroupId: meeting.imGroupId,
                    exists: true,
                },
            });
        }

        // 群组不存在，需要创建
        console.log(`ℹ️ 群组不存在，需要创建: meeting_${meetingId}`);
        return res.json({
            success: true,
            data: {
                imGroupId: `meeting_${meetingId}`,  // 返回预期的群组 ID
                exists: false,
                needsCreation: true,
            },
        });
    } catch (error) {
        console.error('Get IM group error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 注册 IM 群组 ID（创建成功后调用）
 * PUT /api/meetings/:meetingId/im-group
 *
 * 说明：
 * - 前端成功创建群组后，将 imGroupId 注册到数据库
 * - 使用 UPDATE ... WHERE im_group_id IS NULL 确保幂等性
 */
router.put('/:meetingId/im-group', async (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { imGroupId, userId } = req.body;

        if (!imGroupId || !userId) {
            return res.status(400).json({
                success: false,
                error: 'imGroupId and userId are required',
            });
        }

        // 更新会议的 imGroupId
        // 使用 WHERE 条件确保只有没有 imGroupId 的会议才会被更新
        const updated = meetingStore.registerImGroupId(meetingId, imGroupId);

        if (!updated) {
            return res.status(409).json({
                success: false,
                error: 'IM group already registered by another user',
                data: {
                    imGroupId: meetingStore.getMeeting(meetingId)?.imGroupId,
                },
            });
        }

        console.log(`✅ IM 群组已注册: ${meetingId} -> ${imGroupId}`);
        return res.json({
            success: true,
            data: { imGroupId },
        });
    } catch (error) {
        console.error('Register IM group error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

// ========== 用户偏好设置 API ==========

/**
 * 获取用户偏好设置
 * GET /api/users/:userId/preferences
 * 注意：这个路由放在 meetings 模块是临时的，未来可以独立到 users 模块
 */
router.get('/users/:userId/preferences', (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const preferences = meetingStore.getUserPreferences(userId);

        // 如果不存在，返回默认值
        if (!preferences) {
            return res.json({
                success: true,
                data: {
                    userId,
                    theme: 'blue',
                    language: 'zh-CN',
                    defaultMicOn: true,
                    defaultCameraOn: true,
                    defaultMicDevice: null,
                    defaultCameraDevice: null,
                },
            });
        }

        return res.json({
            success: true,
            data: preferences,
        });
    } catch (error) {
        console.error('Get preferences error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 更新用户偏好设置
 * PUT /api/users/:userId/preferences
 */
router.put('/users/:userId/preferences', (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const { theme, language, defaultMicOn, defaultCameraOn, defaultMicDevice, defaultCameraDevice } = req.body;

        const preferences = meetingStore.updateUserPreferences(userId, {
            theme,
            language,
            defaultMicOn,
            defaultCameraOn,
            defaultMicDevice,
            defaultCameraDevice,
        });

        return res.json({
            success: true,
            data: preferences,
        });
    } catch (error) {
        console.error('Update preferences error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

// ========== 预约会议 API ==========

/**
 * 创建预约会议
 * POST /api/meetings/scheduled
 */
router.post('/scheduled', (req: Request, res: Response) => {
    try {
        const { title, password, scheduledAt, duration, repeatFrequency, repeatEndType, repeatEndCount, repeatEndDate, userId, participants } = req.body;

        if (!title || !scheduledAt || !userId) {
            return res.status(400).json({
                success: false,
                error: 'title, scheduledAt, and userId are required',
            });
        }

        const meeting = meetingStore.createScheduledMeeting({
            title,
            password,
            scheduledAt: Math.floor(new Date(scheduledAt).getTime() / 1000),
            duration: duration || 30,
            repeatFrequency,
            repeatEndType,
            repeatEndCount,
            repeatEndDate: repeatEndDate ? Math.floor(new Date(repeatEndDate).getTime() / 1000) : undefined,
            createdBy: userId,
            participants,
        });

        return res.json({
            success: true,
            data: meeting,
        });
    } catch (error) {
        console.error('Create scheduled meeting error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取预约会议列表
 * GET /api/meetings/scheduled
 */
router.get('/scheduled', (req: Request, res: Response) => {
    try {
        const userId = req.query.userId as string | undefined;
        const meetings = meetingStore.getScheduledMeetings(userId);

        return res.json({
            success: true,
            data: meetings,
        });
    } catch (error) {
        console.error('Get scheduled meetings error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取会议列表（按状态）
 * GET /api/meetings/list/:status
 */
router.get('/list/:status', (req: Request, res: Response) => {
    try {
        const { status } = req.params;
        const userId = req.query.userId as string | undefined;
        const limit = parseInt(req.query.limit as string) || 50;

        if (!['ongoing', 'scheduled', 'ended'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be ongoing, scheduled, or ended',
            });
        }

        const meetings = meetingStore.getMeetingsByStatus(
            status as 'ongoing' | 'scheduled' | 'ended',
            userId,
            limit
        );

        // 获取每个会议的参与人数
        const meetingsWithCount = meetings.map(m => ({
            ...m,
            participantCount: meetingStore.getMeetingParticipantCount(m.id),
        }));

        return res.json({
            success: true,
            data: meetingsWithCount,
        });
    } catch (error) {
        console.error('Get meetings by status error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 更新预约会议
 * PUT /api/meetings/:meetingId/scheduled
 */
router.put('/:meetingId/scheduled', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { title, password, scheduledAt, duration, repeatFrequency, repeatEndType, repeatEndCount, repeatEndDate, userId } = req.body;

        const meeting = meetingStore.getScheduledMeeting(meetingId);
        if (!meeting) {
            return res.status(404).json({
                success: false,
                error: 'Meeting not found',
            });
        }

        // 只有创建者可以修改
        if (meeting.createdBy !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Only the creator can update this meeting',
            });
        }

        const updated = meetingStore.updateScheduledMeeting(meetingId, {
            title,
            password,
            scheduledAt: scheduledAt ? Math.floor(new Date(scheduledAt).getTime() / 1000) : undefined,
            duration,
            repeatFrequency,
            repeatEndType,
            repeatEndCount,
            repeatEndDate: repeatEndDate ? Math.floor(new Date(repeatEndDate).getTime() / 1000) : undefined,
        });

        return res.json({
            success: true,
            data: updated,
        });
    } catch (error) {
        console.error('Update scheduled meeting error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 取消预约会议
 * DELETE /api/meetings/:meetingId/scheduled
 */
router.delete('/:meetingId/scheduled', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        const success = meetingStore.cancelScheduledMeeting(meetingId, userId);
        if (!success) {
            return res.status(403).json({
                success: false,
                error: 'Cannot cancel meeting. Either it does not exist or you are not the creator.',
            });
        }

        return res.json({
            success: true,
        });
    } catch (error) {
        console.error('Cancel scheduled meeting error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 获取会议参与人列表
 * GET /api/meetings/:meetingId/participants
 */
router.get('/:meetingId/participants', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const participants = meetingStore.getMeetingParticipants(meetingId);

        return res.json({
            success: true,
            data: participants,
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
 * 添加参与人
 * POST /api/meetings/:meetingId/participants
 */
router.post('/:meetingId/participants', (req: Request, res: Response) => {
    try {
        const { meetingId } = req.params;
        const { userId, userName, email } = req.body;

        if (!userId || !userName) {
            return res.status(400).json({
                success: false,
                error: 'userId and userName are required',
            });
        }

        const participant = meetingStore.addMeetingParticipant({
            meetingId,
            userId,
            userName,
            email,
        });

        return res.json({
            success: true,
            data: participant,
        });
    } catch (error) {
        console.error('Add participant error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

/**
 * 移除参与人
 * DELETE /api/meetings/:meetingId/participants/:participantUserId
 */
router.delete('/:meetingId/participants/:participantUserId', (req: Request, res: Response) => {
    try {
        const { meetingId, participantUserId } = req.params;

        const success = meetingStore.removeMeetingParticipant(meetingId, participantUserId);
        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Participant not found',
            });
        }

        return res.json({
            success: true,
        });
    } catch (error) {
        console.error('Remove participant error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

export default router;

