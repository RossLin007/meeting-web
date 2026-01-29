// 智会 - IM React Hook（带本地消息存储和未读消息追踪）

import { useState, useEffect, useCallback, useRef } from 'react';
import { imService } from '@/services/im';
import { notificationManager } from '@/utils/notification';
import type { ChatMessage } from '@/types';

export interface UseIMOptions {
    onError?: (error: Error) => void;
    onNewMessage?: (messages: ChatMessage[]) => void;  // 收到新消息时回调
    onUnreadCountChange?: (count: number) => void;  // 未读消息数量变化回调
    roomId?: string;  // 房间 ID，用于本地存储 key
    isChatVisible?: boolean;  // 聊天面板是否可见
}

export interface UseIMReturn {
    // 状态
    isReady: boolean;
    isJoinedGroup: boolean;  // 是否已加入群组
    unreadCount: number;  // 未读消息数量
    messages: ChatMessage[];

    // 操作
    login: (userId: string, userSig: string) => Promise<void>;
    logout: () => Promise<void>;
    joinGroup: (groupId: string) => Promise<void>;
    leaveGroup: () => Promise<void>;
    sendMessage: (text: string) => Promise<void>;
    sendImage: (file: File, onProgress?: (progress: number) => void) => Promise<void>;  // 发送图片
    sendFile: (file: File, onProgress?: (progress: number) => void) => Promise<void>;  // 发送文件
    loadHistory: (count?: number) => Promise<void>;
    markAsRead: () => void;  // 标记所有消息为已读
    clearLocalCache: () => void;  // 清理本地缓存
}

// 从 localStorage 加载消息
function loadMessagesFromStorage(roomId: string): ChatMessage[] {
    try {
        const key = `meeting_messages_${roomId}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            const messages = JSON.parse(stored);
            // 恢复 Date 对象
            return messages.map((msg: ChatMessage) => ({
                ...msg,
                timestamp: new Date(msg.timestamp),
            }));
        }
    } catch (e) {
        console.error('Failed to load messages from storage:', e);
    }
    return [];
}

// 保存消息到 localStorage
function saveMessagesToStorage(roomId: string, messages: ChatMessage[]) {
    try {
        const key = `meeting_messages_${roomId}`;
        // 只保留最近 100 条消息
        const toSave = messages.slice(-100);
        localStorage.setItem(key, JSON.stringify(toSave));
    } catch (e) {
        console.error('Failed to save messages to storage:', e);
    }
}

function clearMessagesFromStorage(roomId: string) {
    try {
        const key = `meeting_messages_${roomId}`;
        localStorage.removeItem(key);
    } catch (e) {
        console.error('Failed to clear messages from storage:', e);
    }
}

export function useIM(options: UseIMOptions = {}): UseIMReturn {
    const [isReady, setIsReady] = useState(false);
    const [isJoinedGroup, setIsJoinedGroup] = useState(false);  // 群组加入状态
    const [unreadCount, setUnreadCount] = useState(0);  // 未读消息数量
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const currentRoomId = useRef<string>('');
    const lastReadCount = useRef(0);  // 上次已读的消息数量

    // 使用 refs 保存 options 回调，避免闭包陷阱
    const optionsRef = useRef(options);
    optionsRef.current = options;

    // 初始化并设置事件监听
    useEffect(() => {
        console.log('🔧 useIM: 设置事件监听...');

        // 先设置事件监听器（每次都设置，因为 cleanup 会移除）
        imService.on('onReady', () => {
            console.log('✅ useIM: SDK_READY 事件触发');
            setIsReady(true);
        });

        imService.on('onMessageReceived', (newMessages) => {
            setMessages((prev) => {
                const updated = [...prev, ...newMessages];
                // 保存到本地存储
                if (currentRoomId.current) {
                    saveMessagesToStorage(currentRoomId.current, updated);
                }

                // 更新未读消息数量（仅当聊天面板不可见时）
                if (!optionsRef.current.isChatVisible) {
                    setUnreadCount(prevUnread => {
                        const newCount = prevUnread + newMessages.length;
                        optionsRef.current.onUnreadCountChange?.(newCount);

                        // 播放提示音
                        if (newMessages.length > 0) {
                            const firstMessage = newMessages[0];
                            // 不显示通知（避免打扰）
                            notificationManager.playSound('message');
                        }

                        return newCount;
                    });
                }

                return updated;
            });
            optionsRef.current.onNewMessage?.(newMessages);  // 通知调用者
        });

        imService.on('onError', (error) => {
            console.error('❌ useIM: IM 错误:', error);
            optionsRef.current.onError?.(error);
        });

        imService.on('onConnectionLost', () => {
            console.warn('⚠️ useIM: IM 连接断开');
            setIsReady(false);
            setIsJoinedGroup(false);
            optionsRef.current.onError?.(new Error('聊天连接已断开，请刷新页面重试'));
        });

        // 初始化 IM（imService.init() 内部有 guard，多次调用是安全的）
        const init = async () => {
            try {
                await imService.init();
                console.log('✅ useIM: init() 完成');

                // 检查是否已经 ready
                if (imService.getIsReady()) {
                    console.log('✅ useIM: IM 已经 ready');
                    setIsReady(true);
                }
            } catch (error) {
                console.error('❌ useIM: init() 失败', error);
                optionsRef.current.onError?.(error as Error);
            }
        };

        init();

        return () => {
            imService.off('onReady');
            imService.off('onMessageReceived');
            imService.off('onError');
            imService.off('onConnectionLost');
        };
    }, []);  // 空依赖数组 - 只在组件挂载时运行一次

    // 监听聊天面板可见性变化，重置未读消息数量
    useEffect(() => {
        if (options.isChatVisible) {
            setUnreadCount(0);
            options.onUnreadCountChange?.(0);
        }
    }, [options.isChatVisible]);

    // 登录
    const login = useCallback(async (userId: string, userSig: string) => {
        await imService.login(userId, userSig);
    }, []);

    // 登出
    const logout = useCallback(async () => {
        await imService.logout();
        setIsReady(false);
        setMessages([]);
    }, []);

    // 加入群组（简化版：使用后端 API 协调）
    const joinGroup = useCallback(async (groupId: string) => {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        currentRoomId.current = groupId;

        try {
            console.log('🔍 查询 IM 群组状态:', groupId);

            // 1. 查询后端：群组是否已存在
            const response = await fetch(`${API_BASE_URL}/api/meetings/${groupId}/im-group`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: 'current_user' }),
            });

            const result = await response.json();
            if (!result.success) {
                // 会议不存在时提示用户
                if (result.code === 'MEETING_NOT_FOUND') {
                    throw new Error('会议不存在，请先创建会议');
                }
                throw new Error(result.error || 'Failed to check IM group status');
            }

            const { imGroupId, exists, needsCreation } = result.data;

            if (exists) {
                // 2a. 群组已存在，直接加入
                console.log('✅ 群组已存在，直接加入:', imGroupId);
                await imService.joinGroup(groupId);
            } else if (needsCreation) {
                // 2b. 群组不存在，创建并注册
                console.log('ℹ️ 群组不存在，正在创建...');

                // 创建 IM 群组
                await imService.createGroup(groupId);

                // 注册到后端数据库
                const registerResponse = await fetch(`${API_BASE_URL}/api/meetings/${groupId}/im-group`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        imGroupId: `meeting_${groupId}`,
                        userId: 'current_user',
                    }),
                });

                const registerResult = await registerResponse.json();
                if (!registerResult.success) {
                    console.warn('⚠️ 群组注册失败（可能已被其他人注册）:', registerResult.error);
                    // 即使注册失败，如果后端返回了已有的 imGroupId，继续使用
                    if (registerResult.data?.imGroupId) {
                        console.log('✅ 使用已有的群组 ID:', registerResult.data.imGroupId);
                    }
                } else {
                    console.log('✅ 群组已注册到数据库');
                }
            }

            setIsJoinedGroup(true);

            // 从本地存储加载历史消息
            const storedMessages = loadMessagesFromStorage(groupId);
            if (storedMessages.length > 0) {
                console.log(`从本地存储加载 ${storedMessages.length} 条历史消息`);
                setMessages(storedMessages);
            }
        } catch (error) {
            console.error('❌ 加入群组失败:', error);
            setIsJoinedGroup(false);
            throw error;
        }
    }, []);

    // 离开群组
    const leaveGroup = useCallback(async () => {
        await imService.leaveGroup();
        setIsJoinedGroup(false);  // 重置群组加入状态
        setMessages([]);
        currentRoomId.current = '';
    }, []);

    // 发送消息
    const sendMessage = useCallback(async (text: string) => {
        // 检查是否已加入群组
        if (!isJoinedGroup) {
            const error = new Error('请等待连接到聊天室');
            console.error('发送消息失败: 尚未加入群组');
            optionsRef.current.onError?.(error);
            throw error;
        }

        try {
            const message = await imService.sendTextMessage(text);
            setMessages((prev) => {
                const updated = [...prev, message];
                // 保存到本地存储
                if (currentRoomId.current) {
                    saveMessagesToStorage(currentRoomId.current, updated);
                }
                return updated;
            });
        } catch (error) {
            console.error('发送消息失败:', error);
            optionsRef.current.onError?.(error as Error);
            throw error;  // 重新抛出错误，让调用者处理
        }
    }, [isJoinedGroup]);

    // 发送图片
    const sendImage = useCallback(async (file: File, onProgress?: (progress: number) => void) => {
        // 检查是否已加入群组
        if (!isJoinedGroup) {
            const error = new Error('请等待连接到聊天室');
            console.error('发送图片失败: 尚未加入群组');
            optionsRef.current.onError?.(error);
            throw error;
        }

        try {
            const message = await imService.sendImageMessage(file, onProgress);
            setMessages((prev) => {
                const updated = [...prev, message];
                // 保存到本地存储
                if (currentRoomId.current) {
                    saveMessagesToStorage(currentRoomId.current, updated);
                }
                return updated;
            });
        } catch (error) {
            console.error('发送图片失败:', error);
            optionsRef.current.onError?.(error as Error);
            throw error;
        }
    }, [isJoinedGroup]);

    // 发送文件
    const sendFile = useCallback(async (file: File, onProgress?: (progress: number) => void) => {
        // 检查是否已加入群组
        if (!isJoinedGroup) {
            const error = new Error('请等待连接到聊天室');
            console.error('发送文件失败: 尚未加入群组');
            optionsRef.current.onError?.(error);
            throw error;
        }

        try {
            const message = await imService.sendFileMessage(file, onProgress);
            setMessages((prev) => {
                const updated = [...prev, message];
                // 保存到本地存储
                if (currentRoomId.current) {
                    saveMessagesToStorage(currentRoomId.current, updated);
                }
                return updated;
            });
        } catch (error) {
            console.error('发送文件失败:', error);
            optionsRef.current.onError?.(error as Error);
            throw error;
        }
    }, [isJoinedGroup]);

    // 加载历史消息（服务端 + 本地存储）
    const loadHistory = useCallback(async (count = 20) => {
        // 先尝试从服务端加载
        const history = await imService.getMessageList(undefined, count);
        if (history.length > 0) {
            setMessages(history);
        }
        // AVChatRoom 不支持服务端历史，会返回空数组
        // 本地存储的历史已在 joinGroup 时加载
    }, []);

    // 标记所有消息为已读
    const markAsRead = useCallback(() => {
        setUnreadCount(0);
        optionsRef.current.onUnreadCountChange?.(0);
    }, []);

    const clearLocalCache = useCallback(() => {
        if (!currentRoomId.current) return;
        clearMessagesFromStorage(currentRoomId.current);
        setMessages([]);
        setUnreadCount(0);
        optionsRef.current.onUnreadCountChange?.(0);
    }, []);

    return {
        isReady,
        isJoinedGroup,
        unreadCount,
        messages,
        login,
        logout,
        joinGroup,
        leaveGroup,
        sendMessage,
        sendImage,
        sendFile,
        loadHistory,
        markAsRead,
        clearLocalCache,
    };
}

export default useIM;
