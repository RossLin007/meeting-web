// 智会 - 通知工具（提示音和浏览器通知）

/**
 * 通知管理器
 */
class NotificationManager {
    private audioContext: AudioContext | null = null;
    private hasPermission = false;

    /**
     * 初始化音频上下文（需要用户交互后才能播放）
     */
    initAudio(): void {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
    }

    /**
     * 播放提示音
     * @param type 提示音类型
     */
    async playSound(type: 'message' | 'member-join' | 'member-leave'): Promise<void> {
        try {
            // 延迟初始化音频上下文（需要用户交互）
            if (!this.audioContext) {
                this.initAudio();
            }

            if (!this.audioContext) return;

            // 恢复音频上下文（如果被暂停）
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            // 根据类型设置不同的音效
            switch (type) {
                case 'message':
                    // 消息提示音：清脆的"叮"声
                    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.2);
                    break;

                case 'member-join':
                    // 成员加入：温和的提示音
                    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.15);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.2);
                    break;

                case 'member-leave':
                    // 成员离开：低沉的提示音
                    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.15);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.2);
                    break;
            }
        } catch (error) {
            console.warn('Failed to play notification sound:', error);
        }
    }

    /**
     * 请求浏览器通知权限
     */
    async requestNotificationPermission(): Promise<boolean> {
        if (!('Notification' in window)) {
            console.warn('Browser does not support notifications');
            return false;
        }

        if (Notification.permission === 'granted') {
            this.hasPermission = true;
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            this.hasPermission = permission === 'granted';
            return this.hasPermission;
        }

        return false;
    }

    /**
     * 显示浏览器通知
     * @param title 标题
     * @param body 内容
     * @param onClick 点击回调
     */
    async showNotification(
        title: string,
        body: string,
        onClick?: () => void
    ): Promise<void> {
        if (!this.hasPermission) {
            const granted = await this.requestNotificationPermission();
            if (!granted) return;
        }

        try {
            const notification = new Notification(title, {
                body,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: 'meeting-notification',
                requireInteraction: false,
            });

            notification.onclick = () => {
                window.focus();
                onClick?.();
                notification.close();
            };

            // 自动关闭通知
            setTimeout(() => {
                notification.close();
            }, 5000);
        } catch (error) {
            console.warn('Failed to show notification:', error);
        }
    }

    /**
     * 显示新消息通知
     * @param senderName 发送者名称
     * @param content 消息内容
     * @param onClick 点击回调
     */
    async showMessageNotification(
        senderName: string,
        content: string,
        onClick?: () => void
    ): Promise<void> {
        // 同时播放提示音
        await this.playSound('message');

        // 显示浏览器通知
        await this.showNotification(
            `${senderName}`,
            content,
            onClick
        );
    }

    /**
     * 显示成员加入通知
     * @param memberName 成员名称
     */
    async showMemberJoinNotification(memberName: string): Promise<void> {
        await this.playSound('member-join');
    }

    /**
     * 显示成员离开通知
     * @param memberName 成员名称
     */
    async showMemberLeaveNotification(memberName: string): Promise<void> {
        await this.playSound('member-leave');
    }
}

// 单例
export const notificationManager = new NotificationManager();
export default notificationManager;
