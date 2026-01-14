// 智会 - 结束会议弹窗组件

import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/components/common';
import styles from './EndMeetingModal.module.css';

interface EndMeetingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onEndMeeting: () => void;  // 关闭会议（结束会议）
    onLeaveMeeting: () => void; // 离开会议室（会议不关闭）
    isHost: boolean; // 是否是主持人
}

export function EndMeetingModal({
    isOpen,
    onClose,
    onEndMeeting,
    onLeaveMeeting,
    isHost,
}: EndMeetingModalProps) {
    const { t } = useTranslation();

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('endMeeting.title')}
            size="sm"
        >
            <div className={styles.container}>
                <p className={styles.message}>
                    {isHost ? t('endMeeting.hostMessage') : t('endMeeting.message')}
                </p>

                <div className={styles.actions}>
                    {/* 主持人可以结束会议 */}
                    {isHost && (
                        <Button
                            variant="danger"
                            onClick={onEndMeeting}
                            fullWidth
                        >
                            {t('endMeeting.endForAll')}
                        </Button>
                    )}

                    {/* 离开会议室 */}
                    <Button
                        variant="secondary"
                        onClick={onLeaveMeeting}
                        fullWidth
                    >
                        {t('endMeeting.leave')}
                    </Button>

                    {/* 取消 */}
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        fullWidth
                    >
                        {t('common.cancel')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default EndMeetingModal;
