// 智会 - 等候室组件

import { useTranslation } from 'react-i18next';
import styles from './WaitingRoom.module.css';

interface WaitingRoomProps {
    userName: string;
    onLeave: () => void;
}

export function WaitingRoom({ userName, onLeave }: WaitingRoomProps) {
    const { t } = useTranslation();

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                {/* 动画图标 */}
                <div className={styles.iconWrapper}>
                    <div className={styles.pulseRing} />
                    <div className={styles.icon}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </div>
                </div>

                {/* 欢迎文字 */}
                <h2 className={styles.title}>
                    {t('waitingRoom.title', '等候室')}
                </h2>

                <p className={styles.greeting}>
                    {t('waitingRoom.greeting', { name: userName })}
                </p>

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
                <button className={styles.leaveBtn} onClick={onLeave}>
                    {t('waitingRoom.leave', '离开等候室')}
                </button>
            </div>
        </div>
    );
}

export default WaitingRoom;
