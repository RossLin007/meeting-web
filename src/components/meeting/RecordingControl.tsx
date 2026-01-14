// 智会 - 录制控制组件

import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import styles from './RecordingControl.module.css';

interface RecordingControlProps {
    isRecording: boolean;      // 当前用户是否正在录制
    isRoomRecording: boolean;  // 房间是否有人在录制
    recordingTime: number;     // 秒
    isHost: boolean;           // 是否是主持人
    onStartRecording: () => void;
    onStopRecording: () => void;
}

// 格式化时间
function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 图标
const RecordIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="6" />
    </svg>
);

const StopIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
);

export function RecordingControl({
    isRecording,
    isRoomRecording,
    recordingTime,
    isHost,
    onStartRecording,
    onStopRecording,
}: RecordingControlProps) {
    const { t } = useTranslation();

    // 非主持人只能看到录制状态，不能操作
    if (!isHost) {
        if (isRoomRecording) {
            // 有人在录制中，显示录制状态（不显示时间）
            return (
                <div className={clsx(styles.container, styles.recording, styles.viewOnly)}>
                    <span className={styles.indicator} />
                    <span className={styles.statusText}>{t('recording.recordingInProgress')}</span>
                </div>
            );
        }
        // 没有录制，不显示任何内容
        return null;
    }

    // 主持人可以控制录制
    return (
        <div className={clsx(styles.container, isRecording && styles.recording)}>
            {isRecording ? (
                <>
                    <span className={styles.indicator} />
                    <span className={styles.time}>{formatTime(recordingTime)}</span>
                    <button className={styles.stopBtn} onClick={onStopRecording}>
                        <StopIcon />
                        <span>{t('recording.stopRecording')}</span>
                    </button>
                </>
            ) : isRoomRecording ? (
                // 主持人看到有人在录制（可能是自己之前开的）
                <div className={styles.recording}>
                    <span className={styles.indicator} />
                    <span className={styles.time}>{formatTime(recordingTime)}</span>
                    <span className={styles.statusText}>{t('recording.recordingInProgress')}</span>
                </div>
            ) : (
                <button className={styles.startBtn} onClick={onStartRecording}>
                    <RecordIcon />
                    <span>{t('recording.startRecording')}</span>
                </button>
            )}
        </div>
    );
}

export default RecordingControl;
