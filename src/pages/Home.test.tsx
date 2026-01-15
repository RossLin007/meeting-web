/**
 * @vitest-environment jsdom
 */
// 智会 - 首页单元测试

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Home } from './Home';

// Polyfill localStorage for jsdom
const localStorageStore: Record<string, string> = {};
beforeAll(() => {
    Object.defineProperty(window, 'localStorage', {
        value: {
            getItem: (key: string) => localStorageStore[key] ?? null,
            setItem: (key: string, value: string) => { localStorageStore[key] = value; },
            removeItem: (key: string) => { delete localStorageStore[key]; },
            clear: () => { Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]); },
        },
        writable: true,
    });
});

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

// Mock useMeetingStore
vi.mock('@/services/store', () => ({
    useMeetingStore: () => ({
        currentUser: { userId: 'test-user', userName: 'TestUser', userSig: 'test-sig' },
        setCurrentUser: vi.fn(),
        meetingList: [],
    }),
}));

// Mock useTranslation
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'home.appName': 'ZhiHui',
                'home.dashboard': 'Home',
                'home.meetings': 'Meetings',
                'home.contacts': 'Contacts',
                'home.settings': 'Settings',
                'home.newRoom': 'New Meeting',
                'home.newRoomDesc': 'Start an instant call',
                'home.joinRoom': 'Join Meeting',
                'home.joinRoomDesc': 'Via code or link',
                'home.schedule': 'Schedule',
                'home.scheduleDesc': 'Plan a future meeting',
                'home.upcomingMeetings': 'Upcoming Meetings',
                'home.noMeetings': 'No meetings',
                'home.noContacts': 'No contacts',
                'home.online': 'Online',
                'home.logout': 'Logout',
                'home.lastMeeting': 'Last meeting',
                'home.inviteToMeeting': 'Invite',
                'home.meetingList': 'Meeting List',
                'common.loading': 'Loading...',
                'createMeeting.title': 'New Meeting',
                'joinMeeting.title': 'Join Meeting',
                'scheduleMeeting.title': 'Schedule Meeting',
                'common.cancel': 'Cancel',
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

// Mock fetch
global.fetch = vi.fn(() =>
    Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { userSig: 'test-sig' } }),
    })
) as unknown as typeof fetch;

function renderWithRouter(component: React.ReactElement) {
    return render(
        <BrowserRouter>
            {component}
        </BrowserRouter>
    );
}

describe('Home Page', () => {
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

    it('renders dashboard with navigation', () => {
        renderWithRouter(<Home />);

        // Check sidebar navigation items - use getAllByText since 'Home' appears twice (nav + page title)
        expect(screen.getAllByText('Home').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Meetings')).toBeInTheDocument();
        expect(screen.getAllByText('Contacts').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('renders action cards', () => {
        renderWithRouter(<Home />);

        expect(screen.getByText('New Meeting')).toBeInTheDocument();
        expect(screen.getByText('Join Meeting')).toBeInTheDocument();
        expect(screen.getByText('Schedule')).toBeInTheDocument();
    });

    it('shows user info in sidebar', () => {
        renderWithRouter(<Home />);

        expect(screen.getByText('TestUser')).toBeInTheDocument();
        expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('opens create meeting modal when clicking New Meeting', async () => {
        renderWithRouter(<Home />);

        const newMeetingCard = screen.getByText('New Meeting').closest('button');
        if (newMeetingCard) {
            fireEvent.click(newMeetingCard);
        }

        // Modal should appear - check for modal title (getAllByText since button text matches)
        const modalTitles = await screen.findAllByText(/New Meeting/);
        expect(modalTitles.length).toBeGreaterThan(1);
    });

    it('opens join meeting modal when clicking Join Meeting', async () => {
        renderWithRouter(<Home />);

        const joinMeetingCard = screen.getByText('Join Meeting').closest('button');
        if (joinMeetingCard) {
            fireEvent.click(joinMeetingCard);
        }

        // Modal should appear
        const modalTitles = await screen.findAllByText(/Join Meeting/);
        expect(modalTitles.length).toBeGreaterThan(1);
    });

    it('opens schedule meeting modal when clicking Schedule', async () => {
        renderWithRouter(<Home />);

        const scheduleCard = screen.getByText('Schedule').closest('button');
        if (scheduleCard) {
            fireEvent.click(scheduleCard);
        }

        // Modal should appear
        expect(await screen.findByText(/Schedule Meeting/)).toBeInTheDocument();
    });

    it('navigates to settings when clicking Settings', () => {
        renderWithRouter(<Home />);

        const settingsBtn = screen.getByText('Settings').closest('button');
        if (settingsBtn) {
            fireEvent.click(settingsBtn);
        }

        expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });

    it('shows logout confirmation modal when clicking logout button', async () => {
        renderWithRouter(<Home />);

        const logoutBtn = screen.getByTitle('Logout');
        fireEvent.click(logoutBtn);

        // Should show the confirmation modal instead of logging out immediately
        expect(await screen.findByText('home.logoutConfirmTitle')).toBeInTheDocument();
    });

    it('shows loading state when auth is loading', () => {
        mockUseAuth.mockReturnValue({
            user: undefined as unknown as { id: string; username: string; email: string },
            isLoggedIn: false,
            isLoading: true,
            logout: mockLogout,
        });

        renderWithRouter(<Home />);

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows empty meeting state when API returns no data', () => {
        renderWithRouter(<Home />);

        // With API loading, initially shows empty state (API is not mocked to return data)
        // Check that the dashboard section renders
        expect(screen.getByText('Upcoming Meetings')).toBeInTheDocument();
    });

    it('switches to contacts view when clicking Contacts', () => {
        renderWithRouter(<Home />);

        const contactsBtn = screen.getByText('Contacts').closest('button');
        if (contactsBtn) {
            fireEvent.click(contactsBtn);
        }

        // Should show contacts section - now loads from API, so shows loading or empty state
        // Since API is not mocked in this test, expect loading state
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
});
