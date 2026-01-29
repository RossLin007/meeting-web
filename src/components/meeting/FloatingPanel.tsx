// 智会 - 可拖拽悬浮面板组件（简化版：无最小化）

import { useState, useRef, useEffect, useCallback, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './FloatingPanel.module.css';

interface FloatingPanelProps {
    title: string;
    icon?: ReactNode;
    badge?: number;
    children: ReactNode;
    isOpen: boolean;
    onClose: () => void;
    defaultPosition?: { x: number; y: number };
    defaultSize?: { width: number; height: number };
    minSize?: { width: number; height: number };
}

// 关闭图标
const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export function FloatingPanel({
    title,
    icon,
    badge,
    children,
    isOpen,
    onClose,
    defaultPosition = { x: window.innerWidth - 350, y: 60 },
    defaultSize = { width: 340, height: 500 },
    minSize = { width: 280, height: 300 },
}: FloatingPanelProps) {
    const { t } = useTranslation();
    const containerRef = useRef<HTMLDivElement>(null);

    const [position, setPosition] = useState(defaultPosition);
    const [size, setSize] = useState(defaultSize);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // 拖拽开始
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;

        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        });
    }, [position]);

    // 拖拽中
    const handleDrag = useCallback((e: MouseEvent) => {
        if (!isDragging) return;

        const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.x));
        const newY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y));

        setPosition({ x: newX, y: newY });
    }, [isDragging, dragOffset]);

    // 拖拽结束
    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    // 调整大小开始
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
    }, []);

    // 调整大小中
    const handleResize = useCallback((e: MouseEvent) => {
        if (!isResizing) return;

        const newWidth = Math.max(minSize.width, e.clientX - position.x);
        const newHeight = Math.max(minSize.height, e.clientY - position.y);

        setSize({ width: newWidth, height: newHeight });
    }, [isResizing, position, minSize]);

    // 调整大小结束
    const handleResizeEnd = useCallback(() => {
        setIsResizing(false);
    }, []);

    // 监听全局鼠标事件 - 拖拽
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDrag);
            window.addEventListener('mouseup', handleDragEnd);
            return () => {
                window.removeEventListener('mousemove', handleDrag);
                window.removeEventListener('mouseup', handleDragEnd);
            };
        }
    }, [isDragging, handleDrag, handleDragEnd]);

    // 监听全局鼠标事件 - 调整大小
    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleResize);
            window.addEventListener('mouseup', handleResizeEnd);
            return () => {
                window.removeEventListener('mousemove', handleResize);
                window.removeEventListener('mouseup', handleResizeEnd);
            };
        }
    }, [isResizing, handleResize, handleResizeEnd]);

    if (!isOpen) return null;

    return (
        <div
            ref={containerRef}
            className={styles.container}
            style={{
                left: position.x,
                top: position.y,
                width: size.width,
                height: size.height,
            }}
        >
            {/* 头部 - 拖拽区域 */}
            <div
                className={styles.header}
                onMouseDown={handleDragStart}
            >
                <div className={styles.titleSection}>
                    {icon && <span className={styles.iconWrapper}>{icon}</span>}
                    <h3 className={styles.title}>{title}</h3>
                    {badge !== undefined && badge > 0 && (
                        <span className={styles.badge}>{badge > 99 ? '99+' : badge}</span>
                    )}
                </div>

                <div className={styles.controls}>
                    <button
                        className={styles.controlBtn}
                        onClick={onClose}
                        title={t('common.close', '关闭')}
                    >
                        <CloseIcon />
                    </button>
                </div>
            </div>

            {/* 内容区域 */}
            <div className={styles.content}>
                {children}
            </div>

            {/* 调整大小手柄 */}
            <div
                className={styles.resizeHandle}
                onMouseDown={handleResizeStart}
            />
        </div>
    );
}

export default FloatingPanel;
