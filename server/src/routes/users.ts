// 智会后端 - 用户 API 路由

import { Router, Request, Response } from 'express';
import db from '../db/index.js';

const router = Router();

// 注册/更新用户（SSO 登录后调用）
router.post('/api/users/register', (req: Request, res: Response) => {
    try {
        const { id, name, email, avatar } = req.body;

        if (!id || !name) {
            res.status(400).json({ success: false, error: '缺少必要字段: id, name' });
            return;
        }

        // 使用 upsert 语法（SQLite）
        const stmt = db.prepare(`
            INSERT INTO users (id, name, avatar, updated_at)
            VALUES (?, ?, ?, strftime('%s', 'now'))
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                avatar = excluded.avatar,
                updated_at = strftime('%s', 'now')
        `);

        stmt.run(id, name, avatar || null);

        console.log('✅ 用户注册/更新成功:', id, name);
        res.json({ success: true, data: { id, name, avatar } });
    } catch (error) {
        console.error('❌ 用户注册失败:', error);
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 批量查询用户名
router.get('/api/users', (req: Request, res: Response) => {
    try {
        const idsParam = req.query.ids as string;

        if (!idsParam) {
            res.status(400).json({ success: false, error: '缺少 ids 参数' });
            return;
        }

        const ids = idsParam.split(',').filter(id => id.trim());

        if (ids.length === 0) {
            res.json({ success: true, data: {} });
            return;
        }

        // 构建占位符
        const placeholders = ids.map(() => '?').join(',');
        const stmt = db.prepare(`
            SELECT id, name, avatar FROM users WHERE id IN (${placeholders})
        `);

        const users = stmt.all(...ids) as { id: string; name: string; avatar: string | null }[];

        // 转换为 { id -> { name, avatar } } 格式
        const userMap: Record<string, { name: string; avatar: string | null }> = {};
        users.forEach(u => {
            userMap[u.id] = { name: u.name, avatar: u.avatar };
        });

        res.json({ success: true, data: userMap });
    } catch (error) {
        console.error('❌ 查询用户失败:', error);
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 获取单个用户信息
router.get('/api/users/:id', (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const stmt = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?');
        const user = stmt.get(id) as { id: string; name: string; avatar: string | null } | undefined;

        if (!user) {
            res.status(404).json({ success: false, error: '用户不存在' });
            return;
        }

        res.json({ success: true, data: user });
    } catch (error) {
        console.error('❌ 获取用户失败:', error);
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

// 更新用户名称
router.patch('/api/users/:id/name', (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, operatorId } = req.body;

        if (!name) {
            res.status(400).json({ success: false, error: '缺少 name 参数' });
            return;
        }

        // 查找用户
        const checkStmt = db.prepare('SELECT id FROM users WHERE id = ?');
        const existingUser = checkStmt.get(id);

        if (!existingUser) {
            res.status(404).json({ success: false, error: '用户不存在' });
            return;
        }

        // 更新名称
        const updateStmt = db.prepare(`
            UPDATE users SET name = ?, updated_at = strftime('%s', 'now') WHERE id = ?
        `);
        updateStmt.run(name, id);

        console.log('✅ 用户名称更新成功:', id, name, '操作者:', operatorId);
        res.json({ success: true, data: { id, name } });
    } catch (error) {
        console.error('❌ 更新用户名称失败:', error);
        res.status(500).json({ success: false, error: '服务器错误' });
    }
});

export default router;
