// 智会后端 - 联系人 API 路由

import { Router, Request, Response } from 'express';
import * as contactStore from '../services/contactStore.js';

const router = Router();

// ==================== 分组管理 ====================

/**
 * GET /api/contacts/groups
 * 获取用户的所有联系人分组
 */
router.get('/groups', (req: Request, res: Response) => {
    try {
        const userId = req.query.userId as string;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const groups = contactStore.getGroups(userId);
        return res.json({ success: true, data: groups });
    } catch (error) {
        console.error('Get groups error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * POST /api/contacts/groups
 * 创建联系人分组
 */
router.post('/groups', (req: Request, res: Response) => {
    try {
        const { userId, name, color } = req.body;
        if (!userId || !name) {
            return res.status(400).json({ success: false, error: 'userId and name are required' });
        }

        const group = contactStore.createGroup(userId, name, color);
        if (group) {
            return res.status(201).json({ success: true, data: group });
        }
        return res.status(400).json({ success: false, error: 'Failed to create group (maybe duplicate name)' });
    } catch (error) {
        console.error('Create group error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * PUT /api/contacts/groups/:id
 * 更新联系人分组
 */
router.put('/groups/:id', (req: Request, res: Response) => {
    try {
        const groupId = parseInt(req.params.id, 10);
        const { userId, name, color, sortOrder } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const success = contactStore.updateGroup(userId, groupId, { name, color, sortOrder });
        if (success) {
            return res.json({ success: true });
        }
        return res.status(404).json({ success: false, error: 'Group not found' });
    } catch (error) {
        console.error('Update group error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * DELETE /api/contacts/groups/:id
 * 删除联系人分组
 */
router.delete('/groups/:id', (req: Request, res: Response) => {
    try {
        const groupId = parseInt(req.params.id, 10);
        const userId = req.query.userId as string;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const success = contactStore.deleteGroup(userId, groupId);
        if (success) {
            return res.json({ success: true });
        }
        return res.status(404).json({ success: false, error: 'Group not found' });
    } catch (error) {
        console.error('Delete group error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ==================== 联系人管理 ====================

/**
 * GET /api/contacts
 * 获取联系人列表（支持分组筛选、搜索、分页）
 */
router.get('/', (req: Request, res: Response) => {
    try {
        const userId = req.query.userId as string;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const params: contactStore.ContactsQueryParams = {
            userId,
            groupId: req.query.groupId ? parseInt(req.query.groupId as string, 10) : undefined,
            search: req.query.search as string | undefined,
            page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
        };

        const result = contactStore.getContacts(params);
        return res.json({ success: true, data: result });
    } catch (error) {
        console.error('Get contacts error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * POST /api/contacts/sync
 * 从历史会议同步联系人
 */
router.post('/sync', (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const syncedCount = contactStore.syncContactsFromMeetings(userId);
        return res.json({
            success: true,
            data: { syncedCount },
            message: `Successfully synced ${syncedCount} contacts from meeting history`
        });
    } catch (error) {
        console.error('Sync contacts error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /api/contacts/:id
 * 获取单个联系人详情
 */
router.get('/:id', (req: Request, res: Response) => {
    try {
        const contactId = parseInt(req.params.id, 10);
        const userId = req.query.userId as string;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const contact = contactStore.getContactById(userId, contactId);
        if (contact) {
            return res.json({ success: true, data: contact });
        }
        return res.status(404).json({ success: false, error: 'Contact not found' });
    } catch (error) {
        console.error('Get contact error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * PUT /api/contacts/:id
 * 更新联系人信息
 */
router.put('/:id', (req: Request, res: Response) => {
    try {
        const contactId = parseInt(req.params.id, 10);
        const { userId, contactName, contactEmail, contactAvatar, groupId } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const success = contactStore.updateContact(userId, contactId, {
            contactName,
            contactEmail,
            contactAvatar,
            groupId,
        });

        if (success) {
            return res.json({ success: true });
        }
        return res.status(404).json({ success: false, error: 'Contact not found' });
    } catch (error) {
        console.error('Update contact error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * DELETE /api/contacts/:id
 * 删除联系人
 */
router.delete('/:id', (req: Request, res: Response) => {
    try {
        const contactId = parseInt(req.params.id, 10);
        const userId = req.query.userId as string;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const success = contactStore.deleteContact(userId, contactId);
        if (success) {
            return res.json({ success: true });
        }
        return res.status(404).json({ success: false, error: 'Contact not found' });
    } catch (error) {
        console.error('Delete contact error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * POST /api/contacts/:id/group
 * 设置联系人分组
 */
router.post('/:id/group', (req: Request, res: Response) => {
    try {
        const contactId = parseInt(req.params.id, 10);
        const { userId, groupId } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        const success = contactStore.setContactGroup(userId, contactId, groupId ?? null);
        if (success) {
            return res.json({ success: true });
        }
        return res.status(404).json({ success: false, error: 'Contact not found' });
    } catch (error) {
        console.error('Set contact group error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /api/contacts/:id/meetings
 * 获取与联系人的历史会议记录
 */
router.get('/:id/meetings', (req: Request, res: Response) => {
    try {
        const contactId = parseInt(req.params.id, 10);
        const userId = req.query.userId as string;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }

        // 先获取联系人信息以获取 contact_user_id
        const contact = contactStore.getContactById(userId, contactId);
        if (!contact) {
            return res.status(404).json({ success: false, error: 'Contact not found' });
        }

        const meetings = contactStore.getContactMeetingHistory(userId, contact.contactUserId, limit);
        return res.json({ success: true, data: meetings });
    } catch (error) {
        console.error('Get contact meetings error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

export default router;
