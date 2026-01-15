// 智会 - 远程视频订阅 Hook（基于 ref 注册）

import { useCallback, useEffect, useRef } from 'react';

export interface UseRemoteVideoOptions {
    remoteUsers: string[];
    availableUsers?: string[];
    startRemoteVideo: (userId: string, view: string | HTMLElement, isSub?: boolean) => Promise<boolean>;
    stopRemoteVideo: (userId: string, isSub?: boolean) => Promise<void>;
}

export interface UseRemoteVideoReturn {
    registerRemoteVideo: (userId: string) => (element: HTMLDivElement | null) => void;
}

export function useRemoteVideo({
    remoteUsers,
    availableUsers,
    startRemoteVideo,
    stopRemoteVideo,
}: UseRemoteVideoOptions): UseRemoteVideoReturn {
    const elementMapRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const activeStreamsRef = useRef<Set<string>>(new Set());
    const retryTimersRef = useRef<Map<string, number>>(new Map());
    const retryCountsRef = useRef<Map<string, number>>(new Map());
    const startStreamRef = useRef<(userId: string, element: HTMLDivElement) => void>(() => {});
    const availableUsersRef = useRef<string[]>(availableUsers ?? remoteUsers);

    useEffect(() => {
        availableUsersRef.current = availableUsers ?? remoteUsers;
    }, [availableUsers, remoteUsers]);

    const clearRetry = useCallback((userId: string) => {
        const timerId = retryTimersRef.current.get(userId);
        if (timerId !== undefined) {
            window.clearTimeout(timerId);
            retryTimersRef.current.delete(userId);
        }
        retryCountsRef.current.delete(userId);
    }, []);

    const scheduleRetry = useCallback((userId: string) => {
        const attempts = retryCountsRef.current.get(userId) ?? 0;
        if (attempts >= 6) return;
        if (retryTimersRef.current.has(userId)) return;

        retryCountsRef.current.set(userId, attempts + 1);
        const delay = 500 * (attempts + 1);
        const timerId = window.setTimeout(() => {
            retryTimersRef.current.delete(userId);
            const element = elementMapRef.current.get(userId);
            if (!element) return;
            if (!availableUsersRef.current.includes(userId)) return;
            startStreamRef.current(userId, element);
        }, delay);
        retryTimersRef.current.set(userId, timerId);
    }, []);

    const startStream = useCallback((userId: string, element: HTMLDivElement) => {
        if (activeStreamsRef.current.has(userId)) return;
        startRemoteVideo(userId, element)
            .then((started) => {
                if (started) {
                    activeStreamsRef.current.add(userId);
                    clearRetry(userId);
                    return;
                }
                scheduleRetry(userId);
            })
            .catch((err) => {
                console.error('远程视频订阅失败:', userId, err);
                scheduleRetry(userId);
            });
    }, [startRemoteVideo, clearRetry, scheduleRetry]);

    startStreamRef.current = startStream;

    const stopStream = useCallback((userId: string) => {
        if (!activeStreamsRef.current.has(userId)) return;
        stopRemoteVideo(userId)
            .catch((err) => console.error('远程视频停止失败:', userId, err))
            .finally(() => activeStreamsRef.current.delete(userId));
        clearRetry(userId);
    }, [stopRemoteVideo, clearRetry]);

    const registerRemoteVideo = useCallback((userId: string) => {
        return (element: HTMLDivElement | null) => {
            if (element) {
                elementMapRef.current.set(userId, element);
                if (availableUsersRef.current.includes(userId)) {
                    startStream(userId, element);
                }
                return;
            }

            elementMapRef.current.delete(userId);
            stopStream(userId);
        };
    }, [startStream, stopStream]);

    useEffect(() => {
        const availableList = availableUsers ?? remoteUsers;
        const availableSet = new Set(availableList);
        const remoteUserSet = new Set(remoteUsers);

        // 启动新用户的视频
        availableSet.forEach((userId) => {
            const element = elementMapRef.current.get(userId);
            if (!element) return;

            startStream(userId, element);
        });

        // 清理离开或关闭视频的用户
        activeStreamsRef.current.forEach((userId) => {
            if (remoteUserSet.has(userId) && availableSet.has(userId)) return;
            stopStream(userId);
        });

        // 清理失效的重试
        retryTimersRef.current.forEach((_, userId) => {
            if (remoteUserSet.has(userId) && availableSet.has(userId)) return;
            clearRetry(userId);
        });
    }, [remoteUsers, availableUsers, startStream, stopStream, clearRetry]);

    useEffect(() => {
        return () => {
            retryTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
            retryTimersRef.current.clear();
            retryCountsRef.current.clear();
        };
    }, []);

    return {
        registerRemoteVideo,
    };
}

export default useRemoteVideo;
