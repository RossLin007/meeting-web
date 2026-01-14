// 智会后端 - UserSig API 路由

import { Router, Request, Response } from 'express';
import { generateUserSig } from '../utils/userSig';

const router = Router();

/**
 * 生成 UserSig
 * POST /api/usersig/generate
 */
router.post('/generate', (req: Request, res: Response) => {
    try {
        const { userId, expire } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required',
            });
        }

        const userSig = generateUserSig(userId, expire);

        return res.json({
            success: true,
            data: {
                userSig,
                sdkAppId: Number(process.env.TRTC_SDK_APP_ID) || 20032332,
            },
        });
    } catch (error) {
        console.error('Generate UserSig error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});

export default router;
