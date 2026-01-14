// 智会 - 腾讯 IM 服务封装

import TencentCloudChat from '@tencentcloud/chat';
import TIMUploadPlugin from 'tim-upload-plugin';
import type { ChatMessage, MessageType } from '@/types';

// IM 配置（移除硬编码后备值）
const SDK_APP_ID = Number(import.meta.env.VITE_TRTC_SDK_APP_ID);
if (!SDK_APP_ID || isNaN(SDK_APP_ID)) {
    console.error('❌ 缺少 VITE_TRTC_SDK_APP_ID 配置');
}

// 事件类型
export type IMEventCallback = {
    onMessageReceived: (messages: ChatMessage[]) => void;
    onCustomMessage: (event: RoomStateEvent) => void;  // 房间状态事件
    onReady: () => void;
    onError: (error: Error) => void;
    onConnectionLost: () => void;  // 连接断开
};

// 房间状态事件类型（前置声明）
export interface RoomStateEvent {
    type: 'RECORDING_STARTED' | 'RECORDING_STOPPED' | 'MEMBER_MUTED' | 'MEMBER_UNMUTED'
    | 'MEMBER_CAMERA_ON' | 'MEMBER_CAMERA_OFF' | 'HOST_CHANGED' | 'ROOM_STATE_UPDATE'
    | 'MEETING_ENDED'
    | 'MEMBER_AUDIO_ON' | 'MEMBER_AUDIO_OFF'  // 音频状态
    | 'MEMBER_VIDEO_ON' | 'MEMBER_VIDEO_OFF'  // 视频状态
    | 'MEMBER_NAME_CHANGED'                   // 名称变更
    | 'MEMBER_SCREEN_SHARE_ON' | 'MEMBER_SCREEN_SHARE_OFF';  // 屏幕共享状态
    data: Record<string, unknown>;
    timestamp: number;
}

class IMService {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private chat: any = null;
    private isReady = false;
    private currentGroupId: string | null = null;
    private callbacks: Partial<IMEventCallback> = {};

    // 初始化 IM
    async init(): Promise<void> {
        if (this.chat) {
            console.warn('IM already initialized');
            return;
        }

        console.log('🔧 开始初始化 IM...');

        this.chat = TencentCloudChat.create({
            SDKAppID: SDK_APP_ID,
        });
        console.log('✅ TencentCloudChat.create 完成');

        // 注册上传插件（必须注册才能发送图片、文件等富媒体消息）
        this.chat.registerPlugin({
            'tim-upload-plugin': TIMUploadPlugin,
        });
        console.log('✅ 上传插件已注册');

        this.setupEventListeners();
        console.log('✅ IM initialized');
    }

    // 设置事件监听
    private setupEventListeners(): void {
        if (!this.chat) return;

        // SDK Ready
        this.chat.on(TencentCloudChat.EVENT.SDK_READY, () => {
            console.log('IM SDK ready');
            this.isReady = true;
            this.callbacks.onReady?.();
        });

        // 消息接收（过滤系统消息，分离自定义消息）
        this.chat.on(TencentCloudChat.EVENT.MESSAGE_RECEIVED, (event: { data: unknown[] }) => {
            console.log('📨 收到新消息事件:', event.data.length, '条');
            console.log('📨 当前群组 ID:', this.currentGroupId);

            const chatMessages: unknown[] = [];
            const customEvents: RoomStateEvent[] = [];

            for (const msg of event.data) {
                const m = msg as {
                    type?: string;
                    from?: string;
                    payload?: { data?: string; extension?: string }
                };
                console.log('  消息类型:', m.type, '发送者:', m.from);

                // 过滤 @TIM#SYSTEM 发送者
                if (m.from === '@TIM#SYSTEM') {
                    console.log('  ➡️ 过滤系统消息');
                    continue;
                }
                // 过滤群提示消息
                if (m.type?.includes('TIMGroupTip') || m.type?.includes('TIMGroupSystem')) {
                    console.log('  ➡️ 过滤群提示消息');
                    continue;
                }

                // 检查是否是房间状态自定义消息
                if (m.type === 'TIMCustomElem' && m.payload?.extension === 'room_state') {
                    try {
                        const eventData = JSON.parse(m.payload.data || '{}') as RoomStateEvent;
                        console.log('  📡 房间状态事件:', eventData.type);
                        customEvents.push(eventData);
                    } catch (e) {
                        console.warn('  ⚠️ 解析房间状态事件失败:', e);
                    }
                    continue;
                }

                // 其他消息作为聊天消息
                chatMessages.push(msg);
            }

            // 处理聊天消息
            if (chatMessages.length > 0) {
                const messages = chatMessages.map((msg: unknown) => this.convertMessage(msg));
                console.log('📩 聊天消息:', messages.length, '条');
                this.callbacks.onMessageReceived?.(messages);
            }

            // 处理房间状态事件
            for (const event of customEvents) {
                this.callbacks.onCustomMessage?.(event);
            }
        });

        // 错误
        this.chat.on(TencentCloudChat.EVENT.ERROR, (event: { message: string }) => {
            console.error('IM error:', event.message);
            this.callbacks.onError?.(new Error(event.message));
        });

        // SDK Not Ready - 连接断开
        this.chat.on(TencentCloudChat.EVENT.SDK_NOT_READY, () => {
            console.warn('⚠️ IM SDK not ready - connection lost');
            this.isReady = false;
            this.callbacks.onConnectionLost?.();
        });

        // 被踢下线
        this.chat.on(TencentCloudChat.EVENT.KICKED_OUT, () => {
            console.warn('⚠️ IM user kicked out');
            this.isReady = false;
            this.callbacks.onConnectionLost?.();
        });
    }

    // 转换消息格式
    private convertMessage(msg: unknown): ChatMessage {
        const m = msg as {
            ID: string;
            from: string;
            nick?: string;
            payload?: any;
            time: number;
            type: string;
        };

        // 调试日志 - 打印所有富媒体消息
        if (m.type === 'TIMImageElem' || m.type === 'TIMFileElem') {
            console.log('🔍 富媒体消息原始数据:', {
                type: m.type,
                payload: m.payload,
                payloadKeys: m.payload ? Object.keys(m.payload) : 'no payload',
            });
        }

        const typeMap: Record<string, MessageType> = {
            TIMTextElem: 'text',
            TIMImageElem: 'image',
            TIMFileElem: 'file',
        };

        const messageType = typeMap[m.type] || 'text';
        let content = '';
        let attachment: import('@/types').MessageAttachment | undefined;

        switch (messageType) {
            case 'text':
                content = m.payload?.text || '';
                break;
            case 'image':
                content = '[图片]';
                // @tencentcloud/chat Web SDK 图片消息 payload 结构
                // 根据 https://www.tencentcloud.com/document/product/1047/33527
                // payload = { UUID, ImageFormat, imageInfoArray: [{Type, Size, Width, Height, URL}, ...] }

                let imageUrl = null;
                let imageWidth: number | undefined = undefined;
                let imageHeight: number | undefined = undefined;

                // 优先检查 imageInfoArray（Web SDK 返回的格式）
                if (Array.isArray(m.payload?.imageInfoArray) && m.payload.imageInfoArray.length > 0) {
                    // type: 1=原图, 2=大图, 3=缩略图
                    // 优先使用大图(type=2)，如果没有则使用原图(type=1)
                    const largeImage = m.payload.imageInfoArray.find((img: any) => img.type === 2) || m.payload.imageInfoArray[0];
                    imageUrl = largeImage?.imageUrl;
                    imageWidth = largeImage?.width;
                    imageHeight = largeImage?.height;
                    console.log('✅ 从 imageInfoArray 获取图片:', largeImage);
                } else if (m.payload?.imageUrl) {
                    // 备用：直接在 payload 上
                    imageUrl = m.payload.imageUrl;
                    imageWidth = m.payload.width;
                    imageHeight = m.payload.height;
                    console.log('✅ 从 payload.imageUrl 获取图片');
                }

                if (imageUrl) {
                    attachment = {
                        url: imageUrl,
                        width: imageWidth,
                        height: imageHeight,
                    };
                }

                console.log('🖼️ 图片解析结果:', {
                    hasPayload: !!m.payload,
                    payloadKeys: m.payload ? Object.keys(m.payload) : [],
                    imageInfoArray: m.payload?.imageInfoArray,
                    imageUrl,
                    attachment,
                });
                break;
            case 'file':
                content = `[文件] ${m.payload?.fileName || m.payload?.name || '未知文件'}`;
                // @tencentcloud/chat Web SDK 文件消息 payload 结构
                // 根据 https://www.tencentcloud.com/document/product/1047/33527
                // 实际 SDK 返回: { fileUrl, fileName, fileSize, uuid, downloadFlag }
                if (m.payload?.fileUrl) {
                    attachment = {
                        url: m.payload.fileUrl,
                        name: m.payload.fileName,
                        size: m.payload.fileSize,
                    };
                    console.log('✅ 从 payload.fileUrl 获取文件');
                } else if (m.payload?.url) {
                    // 备用：兼容其他可能的格式
                    attachment = {
                        url: m.payload.url,
                        name: m.payload.name,
                        size: m.payload.size,
                    };
                    console.log('✅ 从 payload.url 获取文件');
                } else if (m.payload?.Url) {
                    // 备用：兼容大写 Url（文档版本）
                    attachment = {
                        url: m.payload.Url,
                        name: m.payload.name || m.payload.FileName,
                        size: m.payload.size || m.payload.FileSize,
                    };
                    console.log('✅ 从 payload.Url 获取文件');
                }

                console.log('📎 文件解析结果:', {
                    hasPayload: !!m.payload,
                    payloadKeys: m.payload ? Object.keys(m.payload) : [],
                    attachment,
                });
                break;
        }

        console.log('📨 转换后的消息:', { type: messageType, content, attachment });

        return {
            id: m.ID,
            senderId: m.from,
            senderName: m.nick || m.from,
            content,
            timestamp: new Date(m.time * 1000),
            type: messageType,
            attachment,
        };
    }

    // 注册回调
    on<K extends keyof IMEventCallback>(event: K, callback: IMEventCallback[K]): void {
        this.callbacks[event] = callback;
    }

    // 移除回调
    off<K extends keyof IMEventCallback>(event: K): void {
        delete this.callbacks[event];
    }

    // 登录（会等待 SDK_READY 事件）
    async login(userId: string, userSig: string): Promise<void> {
        if (!this.chat) {
            throw new Error('IM not initialized');
        }

        // 如果已经 ready，直接返回
        if (this.isReady) {
            console.log('✅ IM already ready, skipping login');
            return;
        }

        console.log('🔐 IM login: 尝试登录 userId:', userId);

        try {
            // 先注册 SDK_READY 事件监听器
            const readyPromise = new Promise<void>((resolve) => {
                const handler = () => {
                    this.chat.off(TencentCloudChat.EVENT.SDK_READY, handler);
                    console.log('✅ SDK_READY 事件触发');
                    resolve();
                };
                this.chat.on(TencentCloudChat.EVENT.SDK_READY, handler);
            });

            // 登录
            const loginResult = await this.chat.login({ userID: userId, userSig });
            console.log('✅ IM login API 调用成功:', userId, loginResult);

            // 检查登录返回码 - 如果已经登录就直接设为 ready
            if (loginResult?.data?.repeatLogin) {
                console.log('✅ IM 检测到重复登录，SDK 已就绪');
                this.isReady = true;
                return;
            }

            // 等待 SDK_READY 事件（最多5秒，如果超时也认为成功，因为可能已经 ready 了）
            console.log('⏳ 等待 SDK_READY...');
            const timeoutPromise = new Promise<void>((resolve) => {
                setTimeout(() => {
                    console.log('⚠️ SDK_READY 等待超时，假设已就绪');
                    resolve();
                }, 5000);
            });

            await Promise.race([readyPromise, timeoutPromise]);
            this.isReady = true;
            console.log('✅ IM login 完成, SDK ready');
        } catch (error) {
            console.error('❌ IM login failed:', error);
            // 检查是否是"已登录"错误，如果是则忽略
            const errorMsg = (error as any)?.message || String(error);
            if (errorMsg.includes('already logged in') ||
                errorMsg.includes('already online') ||
                errorMsg.includes('Repeated login') ||
                errorMsg.includes('SDK_READY timeout')) {
                console.log('✅ IM 已经登录过或就绪，忽略错误');
                this.isReady = true;
                return;
            }
            throw error;
        }
    }

    // 登出
    async logout(): Promise<void> {
        if (!this.chat) return;

        try {
            await this.chat.logout();
            this.isReady = false;
            console.log('IM logged out');
        } catch (error) {
            console.error('Failed to logout IM:', error);
            throw error;
        }
    }

    // 加入群组 (会议房间) - 使用 AVChatRoom 类型
    // 简化版本：假设群组 ID 已经确定，直接加入
    async joinGroup(groupId: string): Promise<void> {
        if (!this.chat) {
            throw new Error('IM not initialized');
        }

        // 等待 isReady 状态
        if (!this.isReady) {
            console.log('⏳ 等待 IM SDK 就绪...');
            await new Promise(resolve => setTimeout(resolve, 500));
            if (!this.isReady) {
                console.warn('⚠️ IM SDK 仍未就绪，尝试继续加入群组');
            }
        }

        // 使用会议前缀避免群组 ID 冲突
        const meetingGroupId = `meeting_${groupId}`;
        console.log('🔵 加入 IM 群组:', meetingGroupId);

        try {
            const joinResult = await this.chat.joinGroup({ groupID: meetingGroupId });
            this.currentGroupId = meetingGroupId;
            console.log('✅ 加入 AVChatRoom 成功:', meetingGroupId, joinResult);
        } catch (error) {
            const e = error as { code?: number; message?: string };
            console.log('🔵 加入群组返回:', e.code, e.message);

            // 已经在群组中 (10013 = already in group)
            if (e.code === 10013) {
                this.currentGroupId = meetingGroupId;
                console.log('✅ 已在 AVChatRoom 中:', meetingGroupId);
            } else if (e.code === 2101) {
                // 未加入群组（可能需要等待 SDK 同步）
                console.warn('⚠️ 群组尚未准备好，2秒后重试...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                try {
                    await this.chat.joinGroup({ groupID: meetingGroupId });
                    this.currentGroupId = meetingGroupId;
                    console.log('✅ 重试加入 AVChatRoom 成功:', meetingGroupId);
                } catch (retryError) {
                    const re = retryError as { code?: number; message?: string };
                    if (re.code === 10013) {
                        this.currentGroupId = meetingGroupId;
                        console.log('✅ 重试时发现已在群组中:', meetingGroupId);
                    } else {
                        console.error('❌ 重试加入群组失败:', re.code, re.message);
                    }
                }
            } else {
                // 其他错误
                console.error('❌ 加入群组失败:', e.code, e.message);
                throw new Error(`Failed to join group: ${e.message || e.code}`);
            }
        }

        // 等待一小段时间确保群组连接建立
        console.log('⏳ 等待群组连接建立...');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ 群组连接已建立, currentGroupId:', this.currentGroupId);
    }

    // 创建群组 (会议房间) - 只在确认需要创建时调用
    async createGroup(groupId: string): Promise<string> {
        if (!this.chat) {
            throw new Error('IM not initialized');
        }

        const meetingGroupId = `meeting_${groupId}`;

        // 检查是否已经在群组中
        if (this.currentGroupId === meetingGroupId) {
            console.log('✅ 已在群组中，跳过创建:', meetingGroupId);
            return meetingGroupId;
        }

        console.log('🔵 创建 IM 群组:', meetingGroupId);

        try {
            const createResult = await this.chat.createGroup({
                groupID: meetingGroupId,
                name: `Meeting ${groupId}`,
                type: TencentCloudChat.TYPES.GRP_AVCHATROOM,
            });
            this.currentGroupId = meetingGroupId;
            console.log('✅ 创建并加入 AVChatRoom 成功:', meetingGroupId, createResult);
            return meetingGroupId;
        } catch (error) {
            const e = error as { code?: number | string; message?: string };
            const codeNum = typeof e.code === 'string' ? parseInt(e.code, 10) : e.code;

            console.error('❌ 创建群组失败:', e.code, e.message);

            // 错误 10025: 自己已经创建过（可能是 React Strict Mode 双重调用）
            // 错误 10021: 其他人已经创建过
            if (codeNum === 10025 || codeNum === 10021) {
                console.log('ℹ️ 群组已存在，尝试加入...');
                try {
                    await this.chat.joinGroup({ groupID: meetingGroupId });
                    this.currentGroupId = meetingGroupId;
                    console.log('✅ 加入已存在的群组成功:', meetingGroupId);
                    return meetingGroupId;
                } catch (joinError) {
                    const je = joinError as { code?: number; message?: string };

                    // 已经在群组中 (10013)
                    if (je.code === 10013) {
                        this.currentGroupId = meetingGroupId;
                        console.log('✅ 已在 AVChatRoom 中:', meetingGroupId);
                        return meetingGroupId;
                    }

                    console.error('❌ 加入群组失败:', je.code, je.message);
                    throw new Error(`Failed to join group: ${je.message || je.code}`);
                }
            }

            throw new Error(`Failed to create group: ${e.message || e.code}`);
        }
    }

    // 离开群组
    async leaveGroup(groupId?: string): Promise<void> {
        if (!this.chat) return;

        const targetGroupId = groupId || this.currentGroupId;
        if (!targetGroupId) return;

        try {
            await this.chat.quitGroup(targetGroupId);
            if (this.currentGroupId === targetGroupId) {
                this.currentGroupId = null;
            }
            console.log('Left group:', targetGroupId);
        } catch (error) {
            console.error('Failed to leave group:', error);
            throw error;
        }
    }

    // 发送文本消息
    async sendTextMessage(text: string, groupId?: string): Promise<ChatMessage> {
        if (!this.chat) {
            console.error('❌ IM not initialized - this.chat is null');
            throw new Error('IM not initialized');
        }

        if (!this.isReady) {
            console.error('❌ IM not ready - connection lost');
            throw new Error('IM connection lost, please refresh the page');
        }

        const targetGroupId = groupId || this.currentGroupId;
        if (!targetGroupId) {
            throw new Error('No group to send message to');
        }

        try {
            const message = this.chat.createTextMessage({
                to: targetGroupId,
                conversationType: TencentCloudChat.TYPES.CONV_GROUP,
                payload: { text },
            });

            const result = await this.chat.sendMessage(message);
            console.log('📤 Text message send result:', result);

            // 检查发送结果状态
            if (result.code && result.code !== 0) {
                console.error('❌ 消息发送失败, code:', result.code, 'message:', result.message);
                throw new Error(`Failed to send message: ${result.message || result.code}`);
            }

            // sendMessage 返回的是 { data: { message: ... } } 或直接是 message
            const sentMessage = result?.data?.message || result?.message || message;
            console.log('✅ Sent text message:', sentMessage.ID, 'to group:', targetGroupId);

            return this.convertMessage(sentMessage);
        } catch (error) {
            const errorMsg = (error as any)?.message || String(error);
            const errorCode = (error as any)?.code;

            // 检查是否是未加入群组错误 (2101)
            if (errorCode === 2101 || errorMsg.includes('not joining it') || errorMsg.includes('2101')) {
                console.log('⚠️ 未加入群组，尝试重新加入...');

                // 最多重试 3 次
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        console.log(`🔄 第 ${attempt} 次尝试重新加入群组...`);

                        // 尝试加入群组
                        await this.chat.joinGroup({ groupID: targetGroupId });
                        this.currentGroupId = targetGroupId;
                        console.log('✅ 重新加入群组成功');

                        // AVChatRoom 需要更长的等待时间让同步完成
                        const waitTime = 500 * attempt;  // 500ms, 1000ms, 1500ms
                        console.log(`⏳ 等待 ${waitTime}ms 让群组同步...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));

                        // 重试发送消息
                        const retryMessage = this.chat.createTextMessage({
                            to: targetGroupId,
                            conversationType: TencentCloudChat.TYPES.CONV_GROUP,
                            payload: { text },
                        });
                        const retryResult = await this.chat.sendMessage(retryMessage);

                        // 检查发送结果
                        if (retryResult.code && retryResult.code !== 0) {
                            throw { code: retryResult.code, message: retryResult.message };
                        }

                        const sentMessage = retryResult?.data?.message || retryResult?.message || retryMessage;
                        console.log('✅ 重试发送成功:', sentMessage.ID);
                        return this.convertMessage(sentMessage);
                    } catch (retryError) {
                        const retryCode = (retryError as any)?.code;
                        console.error(`❌ 第 ${attempt} 次重试失败:`, retryError);

                        // 如果还是 2101 错误，继续重试
                        if (retryCode === 2101 && attempt < 3) {
                            console.log('继续重试...');
                            continue;
                        }

                        // 其他错误或已达最大重试次数
                        if (attempt === 3) {
                            console.error('❌ 已达最大重试次数，发送失败');
                        }
                    }
                }
            }

            console.error('Failed to send message:', error);
            throw error;
        }
    }

    // 发送图片消息
    async sendImageMessage(file: File, onProgress?: (progress: number) => void, groupId?: string): Promise<ChatMessage> {
        if (!this.chat) {
            throw new Error('IM not initialized');
        }

        if (!this.isReady) {
            throw new Error('IM connection lost, please refresh the page');
        }

        const targetGroupId = groupId || this.currentGroupId;
        if (!targetGroupId) {
            throw new Error('No group to send message to');
        }

        try {
            const message = this.chat.createImageMessage({
                to: targetGroupId,
                conversationType: TencentCloudChat.TYPES.CONV_GROUP,
                payload: { file },
                onProgress: (event: { loaded: number; total: number }) => {
                    if (onProgress) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        onProgress(progress);
                    }
                },
            });

            const result = await this.chat.sendMessage(message);
            console.log('📤 Image send result:', result);

            // 检查发送结果状态
            if (result.code && result.code !== 0) {
                console.error('❌ 图片发送失败, code:', result.code, 'message:', result.message);
                throw new Error(`Failed to send image: ${result.message || result.code}`);
            }

            const sentMessage = result?.data?.message || result?.message || message;
            console.log('✅ Sent image message:', sentMessage.ID, 'type:', sentMessage.type, 'to group:', targetGroupId);

            return this.convertMessage(sentMessage);
        } catch (error) {
            console.error('Failed to send image:', error);
            throw error;
        }
    }

    // 发送文件消息
    async sendFileMessage(file: File, onProgress?: (progress: number) => void, groupId?: string): Promise<ChatMessage> {
        if (!this.chat) {
            throw new Error('IM not initialized');
        }

        if (!this.isReady) {
            throw new Error('IM connection lost, please refresh the page');
        }

        const targetGroupId = groupId || this.currentGroupId;
        if (!targetGroupId) {
            throw new Error('No group to send message to');
        }

        try {
            const message = this.chat.createFileMessage({
                to: targetGroupId,
                conversationType: TencentCloudChat.TYPES.CONV_GROUP,
                payload: { file },
                onProgress: (event: { loaded: number; total: number }) => {
                    if (onProgress) {
                        const progress = Math.round((event.loaded / event.total) * 100);
                        onProgress(progress);
                    }
                },
            });

            const result = await this.chat.sendMessage(message);
            console.log('File send result:', result);

            const sentMessage = result?.data?.message || result?.message || message;
            console.log('Sent file:', sentMessage);

            return this.convertMessage(sentMessage);
        } catch (error) {
            console.error('Failed to send file:', error);
            throw error;
        }
    }

    // 获取消息历史（注：AVChatRoom 不支持历史消息）
    async getMessageList(groupId?: string, count = 20): Promise<ChatMessage[]> {
        if (!this.chat) {
            throw new Error('IM not initialized');
        }

        const targetGroupId = groupId || this.currentGroupId;
        if (!targetGroupId) {
            return [];
        }

        try {
            const { data } = await this.chat.getMessageList({
                conversationID: `GROUP${targetGroupId}`,
                count,
            });
            return data.messageList.map((msg: unknown) => this.convertMessage(msg));
        } catch (error) {
            const e = error as { code?: number };
            // 10044: AVChatRoom 不支持历史消息，这是正常的
            if (e.code === 10044) {
                console.log('AVChatRoom 不支持历史消息，返回空列表');
                return [];
            }
            console.error('Failed to get message list:', error);
            return [];  // 返回空数组而不是抛出错误
        }
    }

    // 获取当前群组 ID
    getGroupId(): string | null {
        return this.currentGroupId;
    }

    // 是否已就绪
    getIsReady(): boolean {
        return this.isReady;
    }

    // ========== 房间状态广播 ==========

    /**
     * 发送自定义消息（用于广播房间状态变化）
     */
    async sendCustomMessage(data: RoomStateEvent): Promise<void> {
        if (!this.chat || !this.currentGroupId) {
            console.warn('Cannot send custom message: IM not ready or not in group');
            return;
        }

        try {
            const message = this.chat.createCustomMessage({
                to: this.currentGroupId,
                conversationType: TencentCloudChat.TYPES.CONV_GROUP,
                payload: {
                    data: JSON.stringify(data),
                    description: data.type,
                    extension: 'room_state',
                },
            });

            await this.chat.sendMessage(message);
            console.log('📤 广播房间状态:', data.type);
        } catch (error) {
            console.error('Failed to send custom message:', error);
        }
    }

    /**
     * 广播录制状态变化
     */
    async broadcastRecordingState(isRecording: boolean, recordingInfo?: {
        taskId: string;
        startedBy: string;
        startedAt: number;
    }): Promise<void> {
        await this.sendCustomMessage({
            type: isRecording ? 'RECORDING_STARTED' : 'RECORDING_STOPPED',
            data: { isRecording, ...recordingInfo },
            timestamp: Date.now(),
        });
    }

    /**
     * 广播成员状态变化
     */
    async broadcastMemberUpdate(eventType: 'MEMBER_MUTED' | 'MEMBER_UNMUTED' | 'MEMBER_CAMERA_ON' | 'MEMBER_CAMERA_OFF',
        targetUserId: string, operatorId: string): Promise<void> {
        await this.sendCustomMessage({
            type: eventType,
            data: { targetUserId, operatorId },
            timestamp: Date.now(),
        });
    }

    /**
     * 广播音频状态变化
     */
    async broadcastAudioState(userId: string, isAudioOn: boolean): Promise<void> {
        await this.sendCustomMessage({
            type: isAudioOn ? 'MEMBER_AUDIO_ON' : 'MEMBER_AUDIO_OFF',
            data: { userId },
            timestamp: Date.now(),
        });
    }

    /**
     * 广播视频状态变化
     */
    async broadcastVideoState(userId: string, isVideoOn: boolean): Promise<void> {
        await this.sendCustomMessage({
            type: isVideoOn ? 'MEMBER_VIDEO_ON' : 'MEMBER_VIDEO_OFF',
            data: { userId },
            timestamp: Date.now(),
        });
    }

    /**
     * 广播名称变更
     */
    async broadcastNameChange(userId: string, newName: string): Promise<void> {
        await this.sendCustomMessage({
            type: 'MEMBER_NAME_CHANGED',
            data: { userId, newName },
            timestamp: Date.now(),
        });
    }

    /**
     * 广播屏幕共享状态变化
     */
    async broadcastScreenShareState(userId: string, isSharing: boolean): Promise<void> {
        await this.sendCustomMessage({
            type: isSharing ? 'MEMBER_SCREEN_SHARE_ON' : 'MEMBER_SCREEN_SHARE_OFF',
            data: { userId },
            timestamp: Date.now(),
        });
    }

    /**
     * 广播主持人变更
     */
    async broadcastHostChange(newHostId: string, oldHostId: string): Promise<void> {
        await this.sendCustomMessage({
            type: 'HOST_CHANGED',
            data: { newHostId, oldHostId },
            timestamp: Date.now(),
        });
    }

    // 销毁
    destroy(): void {
        if (this.chat) {
            this.chat.destroy();
            this.chat = null;
            this.isReady = false;
            this.currentGroupId = null;
            this.callbacks = {};
            console.log('IM destroyed');
        }
    }
}

// 单例
export const imService = new IMService();
export default imService;

