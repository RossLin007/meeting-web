/**
 * @vitest-environment jsdom
 */
// 智会 - 录制文件管理页面单元测试

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Recordings } from './Recordings';

// Mock useAuth
const mockLogout = vi.fn();
const mockUseAuth = vi.fn(() => ({
    user: { id: 'test-user', username: 'TestUser', email: 'test@example.com' },
    isLoggedIn: true,
    isLoading: false,
    logout: mockLogout,
}));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

// Mock useTranslation
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'recordings.pageTitle': 'Recordings',
                'recordings.noRecordings': 'No recordings',
                'recordings.noRecordingsDesc': 'No recordings available',
                'recordings.title': 'Recording',
                'recordings.downloadRecording': 'Download',
                'recordings.status.recording': 'Recording',
                'recordings.status.completed': 'Completed',
                'recordings.status.failed': 'Failed',
                'recordings.visibility.all': 'All',
                'recordings.visibility.hostOnly': 'Host Only',
                'common.loading': 'Loading...',
                'common.refresh': 'Refresh',
                'common.retry': 'Retry',
                'common.close': 'Close',
                'recordings.videoError': 'Video playback failed. The video format may not be supported.',
                'recordings.openInNewTab': 'Open in New Tab',
            };
            return translations[key] || key;
        },
        i18n: {
            language: 'en-US',
            changeLanguage: vi.fn(),
        },
    }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useSearchParams: () => [new URLSearchParams(), vi.fn()],
    };
});

// Mock fetchWithTimeout
vi.mock('@/utils/fetchWithTimeout', () => ({
    fetchWithTimeout: vi.fn(),
}));

function renderWithRouter(component: React.ReactElement) {
    return render(
        <BrowserRouter>
            {component}
        </BrowserRouter>
    );
}

describe('Recordings Page - Video Error Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue({
            user: { id: 'test-user', username: 'TestUser', email: 'test@example.com' },
            isLoggedIn: true,
            isLoading: false,
            logout: mockLogout,
        });
    });

    afterEach(() => {
        cleanup();
    });

    it('shows video player when recording is selected', async () => {
        const mockRecordings = [
            {
                id: '1',
                taskId: 'task-1',
                startedBy: 'test-user',
                startedAt: Date.now() / 1000,
                endedAt: null,
                duration: 60,
                status: 'completed',
                visibility: 'all',
                fileUrl: 'http://example.com/video.mp4',
                title: 'Test Recording',
            },
        ];

        const { fetchWithTimeout } = await import('@/utils/fetchWithTimeout');
        vi.mocked(fetchWithTimeout).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: mockRecordings, isHost: false }),
        } as Response);

        const { container } = renderWithRouter(<Recordings />);

        // Wait for recordings to load
        await waitFor(() => {
            expect(screen.getByText('Test Recording')).toBeInTheDocument();
        });

        // Find and click the thumbnail div
        const thumbnailElements = container.querySelectorAll('[class*="_thumbnail_"]');
        if (thumbnailElements.length > 0) {
            fireEvent.click(thumbnailElements[0]);
        }

        // Wait for player to appear
        await waitFor(() => {
            const videoElement = container.querySelector('[data-testid="video-player"]');
            expect(videoElement).toBeInTheDocument();
        }, { timeout: 3000 });
    });

    it('shows error message when video fails to load', async () => {
        const mockRecordings = [
            {
                id: '1',
                taskId: 'task-1',
                startedBy: 'test-user',
                startedAt: Date.now() / 1000,
                endedAt: null,
                duration: 60,
                status: 'completed',
                visibility: 'all',
                fileUrl: 'http://example.com/video.mp4',
                title: 'Test Recording',
            },
        ];

        const { fetchWithTimeout } = await import('@/utils/fetchWithTimeout');
        vi.mocked(fetchWithTimeout).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: mockRecordings, isHost: false }),
        } as Response);

        const { container } = renderWithRouter(<Recordings />);

        // Wait for recordings to load
        await waitFor(() => {
            expect(screen.getByText('Test Recording')).toBeInTheDocument();
        });

        // Find and click the thumbnail
        const thumbnailElements = container.querySelectorAll('[class*="_thumbnail_"]');
        if (thumbnailElements.length > 0) {
            fireEvent.click(thumbnailElements[0]);
        }

        // Wait for player to appear
        await waitFor(() => {
            const videoElement = container.querySelector('[data-testid="video-player"]');
            expect(videoElement).toBeInTheDocument();
        }, { timeout: 3000 });

        // Simulate video error
        const videoElement = container.querySelector('[data-testid="video-player"]') as HTMLVideoElement;
        if (videoElement) {
            fireEvent.error(videoElement);
        }

        // Check for error message
        await waitFor(() => {
            expect(screen.getByText(/Video playback failed/)).toBeInTheDocument();
        });
    });

    it('opens video in new tab when clicking error fallback button', async () => {
        const mockRecordings = [
            {
                id: '1',
                taskId: 'task-1',
                startedBy: 'test-user',
                startedAt: Date.now() / 1000,
                endedAt: null,
                duration: 60,
                status: 'completed',
                visibility: 'all',
                fileUrl: 'http://example.com/video.mp4',
                title: 'Test Recording',
            },
        ];

        const { fetchWithTimeout } = await import('@/utils/fetchWithTimeout');
        vi.mocked(fetchWithTimeout).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: mockRecordings, isHost: false }),
        } as Response);

        // Mock window.open
        const mockOpen = vi.fn();
        Object.defineProperty(window, 'open', {
            value: mockOpen,
            writable: true,
        });

        const { container } = renderWithRouter(<Recordings />);

        // Wait for recordings to load
        await waitFor(() => {
            expect(screen.getByText('Test Recording')).toBeInTheDocument();
        });

        // Find and click the thumbnail
        const thumbnailElements = container.querySelectorAll('[class*="_thumbnail_"]');
        if (thumbnailElements.length > 0) {
            fireEvent.click(thumbnailElements[0]);
        }

        // Wait for player
        await waitFor(() => {
            const videoElement = container.querySelector('[data-testid="video-player"]');
            expect(videoElement).toBeInTheDocument();
        }, { timeout: 3000 });

        // Simulate video error
        const videoElement = container.querySelector('[data-testid="video-player"]') as HTMLVideoElement;
        if (videoElement) {
            fireEvent.error(videoElement);
        }

        // Wait for error message and click button
        await waitFor(() => {
            expect(screen.getByText(/Open in New Tab/)).toBeInTheDocument();
        });

        const openNewTabBtn = screen.getByText(/Open in New Tab/);
        fireEvent.click(openNewTabBtn);

        expect(mockOpen).toHaveBeenCalledWith('http://example.com/video.mp4', '_blank');
    });

    it('clears error state when closing player', async () => {
        const mockRecordings = [
            {
                id: '1',
                taskId: 'task-1',
                startedBy: 'test-user',
                startedAt: Date.now() / 1000,
                endedAt: null,
                duration: 60,
                status: 'completed',
                visibility: 'all',
                fileUrl: 'http://example.com/video.mp4',
                title: 'Test Recording',
            },
        ];

        const { fetchWithTimeout } = await import('@/utils/fetchWithTimeout');
        vi.mocked(fetchWithTimeout).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, data: mockRecordings, isHost: false }),
        } as Response);

        const { container } = renderWithRouter(<Recordings />);

        // Wait for recordings to load
        await waitFor(() => {
            expect(screen.getByText('Test Recording')).toBeInTheDocument();
        });

        // Find and click the thumbnail
        const thumbnailElements = container.querySelectorAll('[class*="_thumbnail_"]');
        if (thumbnailElements.length > 0) {
            fireEvent.click(thumbnailElements[0]);
        }

        // Wait for player and simulate error
        await waitFor(() => {
            const videoElement = container.querySelector('[data-testid="video-player"]');
            expect(videoElement).toBeInTheDocument();
        }, { timeout: 3000 });

        const videoElement = container.querySelector('[data-testid="video-player"]') as HTMLVideoElement;
        if (videoElement) {
            fireEvent.error(videoElement);
        }

        // Verify error is shown
        await waitFor(() => {
            expect(screen.getByText(/Video playback failed/)).toBeInTheDocument();
        });

        // Close player
        const closeBtn = screen.getByText('Close');
        fireEvent.click(closeBtn);

        // Player should be closed
        await waitFor(() => {
            expect(screen.queryByText(/Video playback failed/)).not.toBeInTheDocument();
        });
    });
});
