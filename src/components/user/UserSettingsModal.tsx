// 智会 - UserSettingsModal 组件

import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSettingsStorage } from '@/hooks/useSettingsStorage';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import styles from './UserSettingsModal.module.css';

export type TabType = 'profile' | 'settings' | 'devices';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Close Icon Component
function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [recordingFormat, setRecordingFormat] = useSettingsStorage<'mp4' | 'webm'>('recording_format', 'mp4');

  // Reset active tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab('profile');
    }
  }, [isOpen]);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  const handleTabClick = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    onClose();
  }, [logout, onClose]);

  // Get user initials for avatar
  const getUserInitials = useCallback(() => {
    if (!user?.username) return '?';
    return user.username.charAt(0).toUpperCase();
  }, [user?.username]);

  if (!isOpen) return null;

  const modalContent = (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        {/* Header */}
        <div className={styles.header}>
          <h2 id="settings-modal-title" className={styles.title}>
            Settings
          </h2>
          <button
            className={styles.closeIcon}
            onClick={onClose}
            aria-label="Close settings"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'profile' ? styles.active : ''}`}
              onClick={() => handleTabClick('profile')}
              type="button"
            >
              Profile
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'settings' ? styles.active : ''}`}
              onClick={() => handleTabClick('settings')}
              type="button"
            >
              Settings
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'devices' ? styles.active : ''}`}
              onClick={() => handleTabClick('devices')}
              type="button"
            >
              Devices
            </button>
          </div>

          {/* Tab Content */}
          <div className={styles.tabContent}>
            {/* Profile Tab */}
            <div className={`${styles.section} ${activeTab === 'profile' ? styles.active : ''}`}>
              <div className={styles.profileInfo}>
                {/* Avatar */}
                {user?.avatar ? (
                  <div className={styles.avatar}>
                    <img src={user.avatar} alt={user.username} />
                  </div>
                ) : (
                  <div className={styles.avatar}>
                    <div className={styles.avatarPlaceholder}>
                      {getUserInitials()}
                    </div>
                  </div>
                )}

                {/* User Info */}
                <div className={styles.infoRow}>
                  <span className={styles.label}>Username</span>
                  <span className={styles.value}>{user?.username || 'N/A'}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.label}>Email</span>
                  <span className={styles.value}>{user?.email || 'N/A'}</span>
                </div>

                <div className={styles.infoRow}>
                  <span className={styles.label}>Phone</span>
                  <span className={styles.value}>{user?.phone || 'N/A'}</span>
                </div>

                {/* Divider */}
                <div className={styles.divider} />

                {/* Logout Button */}
                <button
                  className={styles.logoutButton}
                  onClick={handleLogout}
                  type="button"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Logout
                </button>
              </div>
            </div>

            {/* Settings Tab */}
            <div className={`${styles.section} ${activeTab === 'settings' ? styles.active : ''}`}>
              <div className={styles.settingsSection}>
                {/* Theme Selector */}
                <div className={styles.settingItem}>
                  <ThemeSelector />
                </div>

                {/* Language Selector */}
                <div className={styles.settingItem}>
                  <LanguageSelector />
                </div>

                {/* Recording Format */}
                <div className={styles.settingItem}>
                  <span className={styles.label}>Recording Format</span>
                  <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                    <button
                      type="button"
                      onClick={() => setRecordingFormat('mp4')}
                      style={{
                        padding: 'var(--spacing-2) var(--spacing-3)',
                        border: `2px solid ${recordingFormat === 'mp4' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-md)',
                        background: recordingFormat === 'mp4' ? 'rgba(37, 99, 235, 0.1)' : 'var(--color-bg)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      MP4
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecordingFormat('webm')}
                      style={{
                        padding: 'var(--spacing-2) var(--spacing-3)',
                        border: `2px solid ${recordingFormat === 'webm' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        borderRadius: 'var(--radius-md)',
                        background: recordingFormat === 'webm' ? 'rgba(37, 99, 235, 0.1)' : 'var(--color-bg)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500,
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      WebM
                    </button>
                  </div>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--spacing-1)' }}>
                    Current: {recordingFormat.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Devices Tab */}
            <div className={`${styles.section} ${activeTab === 'devices' ? styles.active : ''}`}>
              <div className={styles.devicesSection}>
                <div className={styles.infoBox}>
                  <h3 className={styles.infoBoxTitle}>Device Settings</h3>
                  <p className={styles.infoBoxText}>
                    Camera, microphone, and speaker settings are available in the pre-join screen before entering a meeting.
                  </p>
                  <p className={styles.infoBoxText} style={{ marginTop: 'var(--spacing-2)' }}>
                    You can configure your devices when joining a meeting or by accessing the device settings from the meeting controls.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default UserSettingsModal;
