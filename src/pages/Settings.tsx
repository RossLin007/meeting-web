// 智会 - 设置页面

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import styles from './Settings.module.css';

// 图标组件
const ArrowLeftIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </svg>
);

const LanguageIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

const MicIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
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

const SpeakerIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
);

const UserIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

interface MediaDevice {
    deviceId: string;
    label: string;
}

export function Settings() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [microphones, setMicrophones] = useState<MediaDevice[]>([]);
    const [cameras, setCameras] = useState<MediaDevice[]>([]);
    const [speakers, setSpeakers] = useState<MediaDevice[]>([]);

    const [selectedMic, setSelectedMic] = useState('');
    const [selectedCamera, setSelectedCamera] = useState('');
    const [selectedSpeaker, setSelectedSpeaker] = useState('');

    // 获取可用设备
    useEffect(() => {
        const getDevices = async () => {
            try {
                // 请求权限
                await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

                const devices = await navigator.mediaDevices.enumerateDevices();

                const mics = devices
                    .filter(d => d.kind === 'audioinput')
                    .map(d => ({ deviceId: d.deviceId, label: d.label || `Microphone ${d.deviceId.slice(0, 5)}` }));

                const cams = devices
                    .filter(d => d.kind === 'videoinput')
                    .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}` }));

                const spks = devices
                    .filter(d => d.kind === 'audiooutput')
                    .map(d => ({ deviceId: d.deviceId, label: d.label || `Speaker ${d.deviceId.slice(0, 5)}` }));

                setMicrophones(mics);
                setCameras(cams);
                setSpeakers(spks);

                // 设置默认选中
                if (mics.length > 0) setSelectedMic(mics[0].deviceId);
                if (cams.length > 0) setSelectedCamera(cams[0].deviceId);
                if (spks.length > 0) setSelectedSpeaker(spks[0].deviceId);
            } catch (error) {
                console.error('Failed to get devices:', error);
            }
        };

        getDevices();
    }, []);

    const handleLanguageChange = (lang: string) => {
        i18n.changeLanguage(lang);
        localStorage.setItem('language', lang);
    };

    return (
        <div className={styles.container}>
            {/* 头部 */}
            <header className={styles.header}>
                <button className={styles.backBtn} onClick={() => navigate('/')}>
                    <ArrowLeftIcon />
                </button>
                <h1 className={styles.title}>{t('settings.title')}</h1>
            </header>

            {/* 设置内容 */}
            <main className={styles.main}>
                {/* 账户信息 */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <UserIcon />
                        {t('settings.account')}
                    </h2>
                    <div className={styles.card}>
                        <div className={styles.userInfo}>
                            <div className={styles.avatar}>
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div className={styles.userDetails}>
                                <span className={styles.userName}>{user?.username || 'User'}</span>
                                <span className={styles.userEmail}>{user?.email || ''}</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 语言设置 */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <LanguageIcon />
                        {t('settings.language')}
                    </h2>
                    <div className={styles.card}>
                        <div className={styles.options}>
                            <button
                                className={`${styles.optionBtn} ${i18n.language === 'zh-CN' ? styles.active : ''}`}
                                onClick={() => handleLanguageChange('zh-CN')}
                            >
                                中文
                            </button>
                            <button
                                className={`${styles.optionBtn} ${i18n.language === 'en-US' ? styles.active : ''}`}
                                onClick={() => handleLanguageChange('en-US')}
                            >
                                English
                            </button>
                        </div>
                    </div>
                </section>

                {/* 麦克风设置 */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <MicIcon />
                        {t('settings.microphone')}
                    </h2>
                    <div className={styles.card}>
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
                </section>

                {/* 摄像头设置 */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <CameraIcon />
                        {t('settings.camera')}
                    </h2>
                    <div className={styles.card}>
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
                </section>

                {/* 扬声器设置 */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <SpeakerIcon />
                        {t('settings.speaker')}
                    </h2>
                    <div className={styles.card}>
                        <select
                            className={styles.select}
                            value={selectedSpeaker}
                            onChange={(e) => setSelectedSpeaker(e.target.value)}
                        >
                            {speakers.map((spk) => (
                                <option key={spk.deviceId} value={spk.deviceId}>
                                    {spk.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default Settings;
