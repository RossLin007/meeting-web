// 智会 - 加入会议前预览页面

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useMeetingStore } from '@/services/store';
import { trtcService } from '@/services/trtc';
import styles from './PreJoin.module.css';

// 图标组件
const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

const MicOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .73-.11 1.44-.32 2.1" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

const CameraIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 7l-7 5 7 5V7z" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
);

const CameraOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

export function PreJoin() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user: authUser, userId: authUserId } = useAuth();
    const { setCurrentUser, setMicOn, setCameraOn } = useMeetingStore();

    const videoRef = useRef<HTMLVideoElement>(null);
    const [displayName, setDisplayName] = useState('');
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [stream, setStream] = useState<MediaStream | null>(null);

    // 初始化显示名称
    useEffect(() => {
        const name = authUser?.nickname || authUser?.name || authUserId || '';
        setDisplayName(name);
    }, [authUser, authUserId]);

    // 初始化摄像头预览
    useEffect(() => {
        let currentStream: MediaStream | null = null;

        const initCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                currentStream = mediaStream;
                setStream(mediaStream);

                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (error) {
                console.error('获取设备失败:', error);
            }
        };

        initCamera();

        return () => {
            // 清理流
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // 切换摄像头
    const handleToggleCamera = useCallback(() => {
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !isCameraOn;
            }
        }
        setIsCameraOn(!isCameraOn);
    }, [stream, isCameraOn]);

    // 切换麦克风
    const handleToggleMic = useCallback(() => {
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !isMicOn;
            }
        }
        setIsMicOn(!isMicOn);
    }, [stream, isMicOn]);

    // 加入会议
    const handleJoinMeeting = async () => {
        if (!displayName.trim() || !roomId) return;

        setIsJoining(true);

        try {
            // 停止预览流
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            // 设置用户信息到 store
            setCurrentUser({
                id: authUserId || '',
                name: displayName.trim(),
                nickname: displayName.trim(),
                avatar: authUser?.avatar || '',
            });
            setMicOn(isMicOn);
            setCameraOn(isCameraOn);

            // 导航到会议室
            navigate(`/meeting/${roomId}`, {
                state: {
                    preJoined: true,
                    displayName: displayName.trim(),
                    isMicOn,
                    isCameraOn,
                },
            });
        } catch (error) {
            console.error('加入会议失败:', error);
            setIsJoining(false);
        }
    };

    // 取消加入
    const handleCancel = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        navigate('/');
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>{t('preJoin.title')}</h1>
                <p className={styles.subtitle}>{t('preJoin.checkDevices')}</p>

                {/* 视频预览 */}
                <div className={styles.videoPreview}>
                    {isCameraOn ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={styles.video}
                        />
                    ) : (
                        <div className={styles.cameraOff}>
                            <CameraOffIcon />
                            <span>{t('preJoin.cameraOff')}</span>
                        </div>
                    )}

                    {/* 设备控制按钮 */}
                    <div className={styles.deviceControls}>
                        <button
                            className={`${styles.deviceBtn} ${!isMicOn ? styles.off : ''}`}
                            onClick={handleToggleMic}
                            title={isMicOn ? t('preJoin.micOff') : t('preJoin.micOn')}
                        >
                            {isMicOn ? <MicIcon /> : <MicOffIcon />}
                        </button>
                        <button
                            className={`${styles.deviceBtn} ${!isCameraOn ? styles.off : ''}`}
                            onClick={handleToggleCamera}
                            title={isCameraOn ? t('preJoin.cameraOff') : t('preJoin.cameraOn')}
                        >
                            {isCameraOn ? <CameraIcon /> : <CameraOffIcon />}
                        </button>
                    </div>
                </div>

                {/* 显示名称输入 */}
                <div className={styles.inputGroup}>
                    <label className={styles.label}>{t('preJoin.displayName')}</label>
                    <input
                        type="text"
                        className={styles.input}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t('preJoin.displayNamePlaceholder')}
                        maxLength={30}
                    />
                </div>

                {/* 操作按钮 */}
                <div className={styles.actions}>
                    <button
                        className={styles.cancelBtn}
                        onClick={handleCancel}
                        disabled={isJoining}
                    >
                        {t('preJoin.cancel')}
                    </button>
                    <button
                        className={styles.joinBtn}
                        onClick={handleJoinMeeting}
                        disabled={!displayName.trim() || isJoining}
                    >
                        {isJoining ? t('preJoin.joining') : t('preJoin.joinNow')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PreJoin;
