// 智会后端 - 腾讯 IM 服务封装

import TencentCloudChat from '@tencentcloud/chat';

// IM 配置
const SDK_APP_ID = Number(process.env.TRTC_SDK_APP_ID) || 20032332;

// 生成管理员 UserSig（实际生产环境应该从服务端生成）
// 注意：这里仅用于演示，生产环境应该使用安全的密钥生成方式
const generateAdminUserSig = (userId: string): string => {
    // TODO: 实现服务端 UserSig 生成
    // 目前使用客户端生成的 UserSig，生产环境需要改为服务端生成
    return '';
};

class IMService {
    private chat: any = null;
    private isReady = false;

    /**
     * 初始化 IM SDK
     */
    async init(): Promise<void> {
        if (this.chat) {
            console.warn('[IM Backend] SDK already initialized');
            return;
        }

        this.chat = TencentCloudChat.create({
            SDKAppID: SDK_APP_ID,
        });

        // 等待 SDK 准备好
        await new Promise<void>((resolve) => {
            this.chat.once(TencentCloudChat.EVENT.SDK_READY, () => {
                this.isReady = true;
                console.log('[IM Backend] SDK ready');
                resolve();
            });
        });

        // 登录为管理员用户
        const adminUserId = 'admin';
        const adminUserSig = generateAdminUserSig(adminUserId);

        if (!adminUserSig) {
            console.warn('[IM Backend] No admin UserSig provided, IM operations limited');
            return;
        }

        try {
            await this.chat.login({
                userID: adminUserId,
                userSig: adminUserSig,
            });
            console.log('[IM Backend] Admin logged in');
        } catch (error) {
            console.error('[IM Backend] Admin login failed:', error);
        }
    }

    /**
     * 创建 IM 群组
     * @param meetingId 会议 ID
     * @returns 群组 ID
     */
    async createGroup(meetingId: string): Promise<string> {
        if (!this.chat) {
            throw new Error('IM SDK not initialized');
        }

        const groupId = `meeting_${meetingId}`;

        try {
            const result = await this.chat.createGroup({
                groupID: groupId,
                name: `会议 ${meetingId}`,
                type: TencentCloudChat.TYPES.GRP_AVCHATROOM,
                introduction: `会议 ${meetingId} 的聊天群组`,
            });

            console.log('[IM Backend] Group created:', groupId);
            return groupId;
        } catch (error: any) {
            // 群组已存在
            if (error.code === 10025 || error.code === 10021) {
                console.log('[IM Backend] Group already exists:', groupId);
                return groupId;
            }
            throw error;
        }
    }

    /**
     * 销毁 IM SDK
     */
    destroy(): void {
        if (this.chat) {
            this.chat.destroy();
            this.chat = null;
            this.isReady = false;
        }
    }
}

// 单例
export const imService = new IMService();
export default imService;
