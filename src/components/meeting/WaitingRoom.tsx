// 智会 - 等候室组件（增强版）

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './WaitingRoom.module.css';

interface WaitingRoomProps {
    userName: string;
    queuePosition?: number;  // 排队位置
    totalWaiting?: number;   // 总等待人数
    onLeave: () => void;
}

// 图标组件
const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
);

const MicOffIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
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
        <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
        <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
);

export function WaitingRoom({
    userName,
    queuePosition,
    totalWaiting,
    onLeave
}: WaitingRoomProps) {
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);

    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [micLevel, setMicLevel] = useState(0);

    // 初始化设备
    useEffect(() => {
        let currentStream: MediaStream | null = null;
        let audioContext: AudioContext | null = null;
        let animationId: number;

        const initDevices = async () => {
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

                // 音量检测
                audioContext = new AudioContext();
                const source = audioContext.createMediaStreamSource(mediaStream);
                const analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                source.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);

                const updateLevel = () => {
                    analyser.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                    setMicLevel(Math.min(100, average * 1.5));
                    animationId = requestAnimationFrame(updateLevel);
                };
                updateLevel();

            } catch (error) {
                console.error('获取设备失败:', error);
            }
        };

        initDevices();

        return () => {
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
            if (audioContext) {
                audioContext.close();
            }
            if (animationId) {
                cancelAnimationFrame(animationId);
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

    // 离开时清理
    const handleLeave = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        onLeave();
    };

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                {/* 标题 */}
                <h2 className={styles.title}>
                    {t('waitingRoom.title', '等候室')}
                </h2>

                <p className={styles.greeting}>
                    {t('waitingRoom.greeting', { name: userName })}
                </p>

                {/* 排队位置 */}
                {queuePosition !== undefined && (
                    <div className={styles.queueInfo}>
                        <span className={styles.queuePosition}>#{queuePosition}</span>
                        <span className={styles.queueText}>
                            {totalWaiting
                                ? t('waitingRoom.queueOf', { total: totalWaiting, defaultValue: `共 ${totalWaiting} 人等待` })
                                : t('waitingRoom.inQueue', '排队中')
                            }
                        </span>
                    </div>
                )}

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
                        </div>
                    )}

                    {/* 设备控制 */}
                    <div className={styles.deviceControls}>
                        <button
                            className={`${styles.deviceBtn} ${!isMicOn ? styles.off : ''}`}
                            onClick={handleToggleMic}
                        >
                            {isMicOn ? <MicIcon /> : <MicOffIcon />}
                        </button>
                        <button
                            className={`${styles.deviceBtn} ${!isCameraOn ? styles.off : ''}`}
                            onClick={handleToggleCamera}
                        >
                            {isCameraOn ? <CameraIcon /> : <CameraOffIcon />}
                        </button>
                    </div>

                    {/* 麦克风音量指示器 */}
                    {isMicOn && (
                        <div className={styles.micLevel}>
                            <div
                                className={styles.micLevelBar}
                                style={{ height: `${micLevel}%` }}
                            />
                        </div>
                    )}
                </div>

                <p className={styles.message}>
                    {t('waitingRoom.waiting')}
                </p>

                {/* 等待动画 */}
                <div className={styles.loader}>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>

                {/* 离开按钮 */}
                <button className={styles.leaveBtn} onClick={handleLeave}>
                    {t('waitingRoom.leave', '离开等候室')}
                </button>
            </div>
        </div>
    );
}

export default WaitingRoom;
