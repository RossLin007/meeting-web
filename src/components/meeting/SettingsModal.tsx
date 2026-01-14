// 智会 - 设置弹窗组件

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button } from '@/components/common';
import { useTheme } from '@/hooks';
import type { ThemeColor, ThemeMode } from '@/types';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface DeviceInfo {
    deviceId: string;
    label: string;
}

// 主题颜色
const themeColors: Record<ThemeColor, string> = {
    blue: '#2563eb',
    lightBlue: '#0ea5e9',
    cyan: '#06b6d4',
    red: '#dc2626',
    pink: '#ec4899',
};

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const { t, i18n } = useTranslation();
    const { color, mode, setColor, setMode, availableColors, availableModes } = useTheme();

    const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
    const [cameras, setCameras] = useState<DeviceInfo[]>([]);
    const [selectedMic, setSelectedMic] = useState<string>('');
    const [selectedCamera, setSelectedCamera] = useState<string>('');

    // 获取设备列表
    useEffect(() => {
        if (!isOpen) return;

        const getDevices = async () => {
            try {
                // 请求权限
                await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

                const devices = await navigator.mediaDevices.enumerateDevices();

                const mics = devices
                    .filter(d => d.kind === 'audioinput')
                    .map(d => ({ deviceId: d.deviceId, label: d.label || `麦克风 ${d.deviceId.slice(0, 8)}` }));

                const cams = devices
                    .filter(d => d.kind === 'videoinput')
                    .map(d => ({ deviceId: d.deviceId, label: d.label || `摄像头 ${d.deviceId.slice(0, 8)}` }));

                setMicrophones(mics);
                setCameras(cams);

                if (mics.length > 0 && !selectedMic) {
                    setSelectedMic(mics[0].deviceId);
                }
                if (cams.length > 0 && !selectedCamera) {
                    setSelectedCamera(cams[0].deviceId);
                }
            } catch (error) {
                console.error('Failed to get devices:', error);
            }
        };

        getDevices();
    }, [isOpen]);

    const handleLanguageChange = (lang: string) => {
        i18n.changeLanguage(lang);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('settings.title')}
            size="medium"
        >
            <div className={styles.container}>
                {/* 语言设置 */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>{t('settings.language')}</h3>
                    <div className={styles.optionGroup}>
                        <button
                            className={`${styles.langOption} ${i18n.language === 'zh-CN' ? styles.active : ''}`}
                            onClick={() => handleLanguageChange('zh-CN')}
                        >
                            🇨🇳 中文
                        </button>
                        <button
                            className={`${styles.langOption} ${i18n.language === 'en-US' ? styles.active : ''}`}
                            onClick={() => handleLanguageChange('en-US')}
                        >
                            🇺🇸 English
                        </button>
                    </div>
                </div>

                {/* 主题模式 */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>{t('theme.mode')}</h3>
                    <div className={styles.optionGroup}>
                        {availableModes.map((m) => (
                            <button
                                key={m}
                                className={`${styles.modeOption} ${mode === m ? styles.active : ''}`}
                                onClick={() => setMode(m)}
                            >
                                {m === 'light' && '☀️'}
                                {m === 'dark' && '🌙'}
                                {m === 'system' && '💻'}
                                <span>{t(`theme.${m}`)}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 主题颜色 */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>{t('theme.color')}</h3>
                    <div className={styles.colorGroup}>
                        {availableColors.map((c) => (
                            <button
                                key={c}
                                className={`${styles.colorOption} ${color === c ? styles.active : ''}`}
                                onClick={() => setColor(c)}
                                title={t(`theme.${c}`)}
                            >
                                <span
                                    className={styles.colorDot}
                                    style={{ backgroundColor: themeColors[c] }}
                                />
                            </button>
                        ))}
                    </div>
                </div>

                {/* 麦克风选择 */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>{t('settings.microphone')}</h3>
                    <select
                        className={styles.select}
                        value={selectedMic}
                        onChange={(e) => setSelectedMic(e.target.value)}
                    >
                        {microphones.map((mic) => (
                            <option key={mic.deviceId} value={mic.deviceId}>
                                {mic.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 摄像头选择 */}
                <div className={styles.section}>
                    <h3 className={styles.sectionTitle}>{t('settings.camera')}</h3>
                    <select
                        className={styles.select}
                        value={selectedCamera}
                        onChange={(e) => setSelectedCamera(e.target.value)}
                    >
                        {cameras.map((cam) => (
                            <option key={cam.deviceId} value={cam.deviceId}>
                                {cam.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* 关闭按钮 */}
                <div className={styles.actions}>
                    <Button variant="primary" onClick={onClose} fullWidth>
                        {t('common.close')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export default SettingsModal;
