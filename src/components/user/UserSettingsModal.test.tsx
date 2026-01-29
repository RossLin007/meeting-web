/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { UserSettingsModal } from './UserSettingsModal';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

// Mock useTranslation
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
}));

// Polyfill localStorage for jsdom
const localStorageStore: Record<string, string> = {};
beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => localStorageStore[key] ?? null,
      setItem: (key: string, value: string) => { localStorageStore[key] = value; },
      removeItem: (key: string) => { delete localStorageStore[key]; },
      clear: () => { Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]); },
    },
    writable: true,
  });

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });

  localStorage.clear();
});

describe('UserSettingsModal', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );

  const defaultProps = {
    isOpen: false,
    onClose: vi.fn(),
  };

  afterEach(() => {
    cleanup();
  });

  describe('Rendering behavior', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(<UserSettingsModal {...defaultProps} />, { wrapper });

      // Modal is rendered in portal to body, so container should be empty
      expect(container.firstChild).toBeNull();
      // Body should not have modal content
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      // Modal title should be in document (via portal)
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Settings', { selector: 'h2' })).toBeInTheDocument();
    });

    it('should render overlay and modal container when open', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      // Check for dialog role
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('Tab functionality', () => {
    it('should render all three tabs', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      expect(screen.getByText('Profile', { selector: 'button' })).toBeInTheDocument();
      expect(screen.getAllByText('Settings')).toHaveLength(2); // One in title, one in tab
      expect(screen.getByText('Devices', { selector: 'button' })).toBeInTheDocument();
    });

    it('should have Profile tab as default active tab', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      const profileTab = screen.getByText('Profile', { selector: 'button' });
      expect(profileTab.className).toContain('active');
    });

    it('should switch to Settings tab when clicked', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      const settingsTab = screen.getAllByText('Settings').find(el => el.tagName === 'BUTTON');
      if (settingsTab) {
        fireEvent.click(settingsTab);
        expect(settingsTab.className).toContain('active');
      }
    });

    it('should switch to Devices tab when clicked', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      const devicesTab = screen.getByText('Devices', { selector: 'button' });
      fireEvent.click(devicesTab);

      expect(devicesTab.className).toContain('active');
    });

    it('should switch between tabs multiple times', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      const profileTab = screen.getByText('Profile', { selector: 'button' });
      const settingsTab = screen.getAllByText('Settings').find(el => el.tagName === 'BUTTON');
      const devicesTab = screen.getByText('Devices', { selector: 'button' });

      // Start with Profile
      expect(profileTab.className).toContain('active');

      // Switch to Settings
      if (settingsTab) {
        fireEvent.click(settingsTab);
        expect(settingsTab.className).toContain('active');
      }

      // Switch to Devices
      fireEvent.click(devicesTab);
      expect(devicesTab.className).toContain('active');

      // Switch back to Profile
      fireEvent.click(profileTab);
      expect(profileTab.className).toContain('active');
    });
  });

  describe('Close functionality', () => {
    it('should call onClose when close button is clicked', () => {
      const mockOnClose = vi.fn();
      render(<UserSettingsModal {...defaultProps} isOpen={true} onClose={mockOnClose} />, { wrapper });

      const closeButton = screen.getByLabelText('Close settings');
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when overlay is clicked', () => {
      const mockOnClose = vi.fn();
      render(<UserSettingsModal {...defaultProps} isOpen={true} onClose={mockOnClose} />, { wrapper });

      // Click outside the modal (on the overlay)
      const dialog = screen.getByRole('dialog');
      const overlay = dialog.parentElement;
      if (overlay) {
        fireEvent.click(overlay);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it('should not call onClose when modal content is clicked', () => {
      const mockOnClose = vi.fn();
      render(<UserSettingsModal {...defaultProps} isOpen={true} onClose={mockOnClose} />, { wrapper });

      const dialog = screen.getByRole('dialog');
      fireEvent.click(dialog);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Profile tab content', () => {
    it('should display user information when Profile tab is active', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Phone')).toBeInTheDocument();
    });

    it('should display logout button', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });

  describe('Settings tab content', () => {
    it('should display theme selector when Settings tab is active', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      // Switch to Settings tab
      const settingsTab = screen.getAllByText('Settings').find(el => el.tagName === 'BUTTON');
      if (settingsTab) {
        fireEvent.click(settingsTab);
        expect(screen.getByText('Theme')).toBeInTheDocument();
      }
    });

    it('should display recording format options', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      // Switch to Settings tab
      const settingsTab = screen.getAllByText('Settings').find(el => el.tagName === 'BUTTON');
      if (settingsTab) {
        fireEvent.click(settingsTab);
        expect(screen.getByText('Recording Format')).toBeInTheDocument();
        expect(screen.getByText('MP4')).toBeInTheDocument();
        expect(screen.getByText('WebM')).toBeInTheDocument();
      }
    });
  });

  describe('Devices tab content', () => {
    it('should display device information when Devices tab is active', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      // Switch to Devices tab
      const devicesTab = screen.getByText('Devices', { selector: 'button' });
      fireEvent.click(devicesTab);

      expect(screen.getByText('Device Settings')).toBeInTheDocument();
      expect(screen.getByText(/Camera, microphone, and speaker settings/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper role and aria attributes', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('role', 'dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    it('should have aria-label on close button', () => {
      render(<UserSettingsModal {...defaultProps} isOpen={true} />, { wrapper });

      const closeButton = screen.getByLabelText('Close settings');
      expect(closeButton).toBeInTheDocument();
    });

    it('should close on ESC key press', () => {
      const mockOnClose = vi.fn();
      render(<UserSettingsModal {...defaultProps} isOpen={true} onClose={mockOnClose} />, { wrapper });

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Tab state reset', () => {
    it('should reset to Profile tab when modal is reopened', () => {
      const { rerender } = render(
        <UserSettingsModal {...defaultProps} isOpen={true} />,
        { wrapper }
      );

      // Switch to Settings tab
      const settingsTab = screen.getAllByText('Settings').find(el => el.tagName === 'BUTTON');
      if (settingsTab) {
        fireEvent.click(settingsTab);
        expect(settingsTab.className).toContain('active');
      }

      // Close and reopen modal
      rerender(<UserSettingsModal {...defaultProps} isOpen={false} />);
      rerender(<UserSettingsModal {...defaultProps} isOpen={true} />);

      // Should be back to Profile tab
      const profileTab = screen.getByText('Profile', { selector: 'button' });
      expect(profileTab.className).toContain('active');
    });
  });
});
