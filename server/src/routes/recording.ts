// 智会后端 - 录制 API 路由

import { Router, Request, Response } from 'express';
import { generateUserSig } from '../utils/userSig';
import recordingService from '../services/recording';

const router = Router();

const SDK_APP_ID = Number(process.env.TRTC_SDK_APP_ID) || 20032332;

/**
 * 启动录制
 * POST /api/recording/start
 */
router.post('/start', async (req: Request, res: Response) => {
    try {
        const { roomId, memberCount = 1 } = req.body;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                error: 'roomId is required',
            });
        }

        // 为录制机器人生成 UserSig
        const recordUserId = `recorder_${roomId}_${Date.now()}`;
        const userSig = generateUserSig(recordUserId);

        // 根据人数决定录制模式：1人用单流，多人用混流
        const useMixStream = memberCount > 1;

        const result = await recordingService.startCloudRecording({
            sdkAppId: SDK_APP_ID,
            roomId: Number(roomId),
            recordUserId,
            userSig,
            useMixStream,
        });

        return res.json(result);
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
 * POST /api/recording/stop
 */
router.post('/stop', async (req: Request, res: Response) => {
    try {
        const { roomId } = req.body;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                error: 'roomId is required',
            });
        }

        const result = await recordingService.stopCloudRecording({
            sdkAppId: SDK_APP_ID,
            roomId: Number(roomId),
        });

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
 * 获取录制状态
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

export default router;
