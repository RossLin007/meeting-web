/**
 * @vitest-environment jsdom
 */
// 智会 - 登录页面单元测试

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Login } from './Login';

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
const mockLogin = vi.fn();
const mockUseAuth = vi.fn(() => ({
    isLoggedIn: false,
    isLoading: false,
    login: mockLogin,
}));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

// Mock useTranslation
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'login.title': 'Welcome to ZhiHui',
                'login.subtitle': 'Make Every Meeting Smarter',
                'login.ssoLogin': 'Login with SSO',
                'login.loggingIn': 'Logging in...',
                'login.terms': 'By logging in, you agree to our Terms of Service',
                'settings.language': 'Language',
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
    };
});

function renderWithRouter(component: React.ReactElement) {
    return render(
        <BrowserRouter>
            {component}
        </BrowserRouter>
    );
}

describe('Login Page', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAuth.mockReturnValue({
            isLoggedIn: false,
            isLoading: false,
            login: mockLogin,
        });
    });

    afterEach(() => {
        cleanup();
    });

    it('renders login page with title and button', () => {
        renderWithRouter(<Login />);

        expect(screen.getByRole('heading', { name: 'Welcome to ZhiHui' })).toBeInTheDocument();
        expect(screen.getByText('Make Every Meeting Smarter')).toBeInTheDocument();
        expect(screen.getByText('Login with SSO')).toBeInTheDocument();
    });

    it('calls login function when login button is clicked', () => {
        renderWithRouter(<Login />);

        const loginButton = screen.getByTestId('login-button');
        fireEvent.click(loginButton);

        expect(mockLogin).toHaveBeenCalledTimes(1);
    });

    it('shows loading state when isLoading is true', () => {
        mockUseAuth.mockReturnValue({
            isLoggedIn: false,
            isLoading: true,
            login: mockLogin,
        });

        renderWithRouter(<Login />);

        expect(screen.getByText('Logging in...')).toBeInTheDocument();
        expect(screen.getByTestId('login-button')).toBeDisabled();
    });

    it('redirects to home when already logged in', () => {
        mockUseAuth.mockReturnValue({
            isLoggedIn: true,
            isLoading: false,
            login: mockLogin,
        });

        renderWithRouter(<Login />);

        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });

    it('has language switch button', () => {
        renderWithRouter(<Login />);

        // Language switch button should exist
        const langButton = screen.getByRole('button', { name: 'Language' });
        expect(langButton).toBeInTheDocument();
    });
});
