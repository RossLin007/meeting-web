// 智会 - 录制 Hook (集成后端 API)

import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

export interface UseRecordingOptions {
    roomId: string;
    memberCount: number;  // 房间人数用于决定录制模式
    subscribeUserIds?: string[];  // 订阅用户列表
    onError?: (error: Error) => void;
}

export interface UseRecordingReturn {
    isRecording: boolean;
    recordingTime: number;
    isStarting: boolean;
    isStopping: boolean;
    startRecording: () => Promise<string | undefined>;  // 返回 taskId
    stopRecording: () => Promise<boolean>;
}

// API 基础 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const DEFAULT_TIMEOUT = 30000;

/**
 * 录制 Hook
 * 
 * 调用后端 API 控制腾讯云 TRTC 云录制
 */
export function useRecording({ roomId, memberCount, subscribeUserIds, onError }: UseRecordingOptions): UseRecordingReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [isStarting, setIsStarting] = useState(false);
    const [isStopping, setIsStopping] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // 清理定时器
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    // 检查录制状态
    useEffect(() => {
        if (!roomId) return;

        const checkStatus = async () => {
            try {
                const response = await fetchWithTimeout(`${API_BASE_URL}/api/recording/status/${roomId}`, {}, DEFAULT_TIMEOUT);
                const data = await response.json();

                if (data.isRecording) {
                    setIsRecording(true);
                    setRecordingTime(data.duration || 0);

                    // 开始计时
                    if (!timerRef.current) {
                        timerRef.current = setInterval(() => {
                            setRecordingTime((prev) => prev + 1);
                        }, 1000);
                    }
                }
            } catch (error) {
                console.error('Failed to check recording status:', error);
            }
        };

        checkStatus();
    }, [roomId]);

    // 开始录制
    const startRecording = useCallback(async (): Promise<string | undefined> => {
        if (!roomId) {
            onError?.(new Error('roomId is required'));
            return undefined;
        }

        try {
            setIsStarting(true);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/recording/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    memberCount,  // 传递人数用于后端决定录制模式
                    subscribeUserIds,
                    userId: localStorage.getItem('uniauth_user')
                        ? JSON.parse(localStorage.getItem('uniauth_user') || '{}').id
                        : undefined,  // 传递当前用户 ID 用于订阅
                }),
            }, DEFAULT_TIMEOUT);

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to start recording');
            }

            console.log('Recording started:', data.taskId);

            setIsRecording(true);
            setRecordingTime(0);

            // 开始计时
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);

            return data.taskId;  // 返回 taskId

        } catch (error) {
            console.error('Failed to start recording:', error);
            onError?.(error as Error);
            return undefined;
        } finally {
            setIsStarting(false);
        }
    }, [roomId, memberCount, subscribeUserIds, onError]);

    // 停止录制
    const stopRecording = useCallback(async (): Promise<boolean> => {
        if (!roomId) {
            onError?.(new Error('roomId is required'));
            return false;
        }

        try {
            setIsStopping(true);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/recording/stop`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ roomId }),
            }, DEFAULT_TIMEOUT);

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to stop recording');
            }

            console.log('Recording stopped:', data.taskId);

            // 停止计时
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }

            setIsRecording(false);
            return true;
        } catch (error) {
            console.error('Failed to stop recording:', error);
            onError?.(error as Error);
            return false;
        } finally {
            setIsStopping(false);
        }
    }, [roomId, onError]);

    return {
        isRecording,
        recordingTime,
        isStarting,
        isStopping,
        startRecording,
        stopRecording,
    };
}

export default useRecording;
