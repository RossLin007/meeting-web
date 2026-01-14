// 智会后端 - 存储管理 API 路由

import { Router, Request, Response } from 'express';
import storageService from '../services/storage';

const router = Router();

/**
 * 获取存储统计信息
 * GET /api/storage/stats
 */
router.get('/stats', async (_req: Request, res: Response) => {
    try {
        const stats = await storageService.getStorageStats();
        return res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('Get storage stats error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get storage stats',
        });
    }
});

/**
 * 获取文件列表
 * GET /api/storage/files
 */
router.get('/files', async (req: Request, res: Response) => {
    try {
        const prefix = (req.query.prefix as string) || 'meeting/';
        const files = await storageService.listFiles(prefix);

        // 为每个文件生成签名 URL
        const filesWithUrl = await Promise.all(
            files.map(async (file) => {
                try {
                    const url = await storageService.getSignedUrl(file.key);
                    return { ...file, url };
                } catch {
                    return file;
                }
            })
        );

        return res.json({
            success: true,
            data: filesWithUrl,
        });
    } catch (error) {
        console.error('List files error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to list files',
        });
    }
});

/**
 * 删除文件
 * DELETE /api/storage/files/:key
 */
router.delete('/files/*', async (req: Request, res: Response) => {
    try {
        // 获取完整的 key (可能包含 /)
        const key = req.params[0];

        if (!key) {
            return res.status(400).json({
                success: false,
                error: 'File key is required',
            });
        }

        await storageService.deleteFile(key);
        return res.json({
            success: true,
            message: 'File deleted successfully',
        });
    } catch (error) {
        console.error('Delete file error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete file',
        });
    }
});

/**
 * 重命名文件
 * PUT /api/storage/files/rename
 */
router.put('/files/rename', async (req: Request, res: Response) => {
    try {
        const { key, newName } = req.body;

        if (!key || !newName) {
            return res.status(400).json({
                success: false,
                error: 'key and newName are required',
            });
        }

        const newKey = await storageService.renameFile(key, newName);
        return res.json({
            success: true,
            data: { newKey },
        });
    } catch (error) {
        console.error('Rename file error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to rename file',
        });
    }
});

/**
 * 获取单个文件的下载链接
 * GET /api/storage/download/:key
 */
router.get('/download/*', async (req: Request, res: Response) => {
    try {
        const key = req.params[0];

        if (!key) {
            return res.status(400).json({
                success: false,
                error: 'File key is required',
            });
        }

        // 生成一个较长有效期的下载链接 (1小时)
        const url = await storageService.getSignedUrl(key, 3600);
        return res.json({
            success: true,
            data: { url },
        });
    } catch (error) {
        console.error('Get download URL error:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get download URL',
        });
    }
});

export default router;
