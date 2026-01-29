// 智会 - 邀请参会者弹窗

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Input } from '@/components/common';
import styles from './InviteModal.module.css';

interface InviteModalProps {
    isOpen: boolean;
    onClose: () => void;
    roomId: string;
    meetingTitle: string;
    password?: string;
}

export function InviteModal({
    isOpen,
    onClose,
    roomId,
    meetingTitle,
    password,
}: InviteModalProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    // 生成邀请链接
    const inviteParams = new URLSearchParams();
    if (meetingTitle) {
        inviteParams.set('title', meetingTitle);
    }
    if (password) {
        inviteParams.set('password', password);
    }
    const inviteQuery = inviteParams.toString();
    const inviteLink = `${window.location.origin}/meeting/${roomId}${inviteQuery ? `?${inviteQuery}` : ''}`;

    // 生成邀请信息
    const inviteText = [
        `${t('invite.joinMeeting')}: ${meetingTitle}`,
        `${t('meeting.roomId')}: ${roomId}`,
        password ? `${t('meeting.password')}: ${password}` : '',
        `${t('invite.link')}: ${inviteLink}`,
    ].filter(Boolean).join('\n');

    // 复制邀请链接
    const handleCopyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }, [inviteLink]);

    // 复制全部邀请信息
    const handleCopyAll = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(inviteText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    }, [inviteText]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('invite.title')}
            size="medium"
        >
            <div className={styles.container}>
                {/* 会议信息 */}
                <div className={styles.infoSection}>
                    <div className={styles.infoItem}>
                        <span className={styles.label}>{t('meeting.title')}:</span>
                        <span className={styles.value}>{meetingTitle}</span>
                    </div>
                    <div className={styles.infoItem}>
                        <span className={styles.label}>{t('meeting.roomId')}:</span>
                        <span className={styles.value}>{roomId}</span>
                    </div>
                    {password && (
                        <div className={styles.infoItem}>
                            <span className={styles.label}>{t('meeting.password')}:</span>
                            <span className={styles.value}>{password}</span>
                        </div>
                    )}
                </div>

                {/* 邀请链接 */}
                <div className={styles.linkSection}>
                    <label className={styles.linkLabel}>{t('invite.link')}</label>
                    <div className={styles.linkInput}>
                        <Input
                            value={inviteLink}
                            readOnly
                            fullWidth
                        />
                        <Button
                            variant={copied ? 'secondary' : 'primary'}
                            onClick={handleCopyLink}
                        >
                            {copied ? t('common.copied') : t('common.copy')}
                        </Button>
                    </div>
                </div>

                {/* 操作按钮 */}
                <div className={styles.actions}>
                    <Button
                        variant="primary"
                        onClick={handleCopyAll}
                        fullWidth
                    >
                        {t('invite.copyAll')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default InviteModal;
