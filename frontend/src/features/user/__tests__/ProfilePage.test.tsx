import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProfilePage from '../ProfilePage';

// Mocks
const mockUpdateUser = vi.fn();
const mockSetTheme = vi.fn();
const mockChangeLanguage = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../../hooks/useAuth', () => ({
    useAuth: () => ({
        user: {
            full_name: 'Test User',
            email: 'test@example.com',
            preferences: { theme: 'light', locale: 'en-US' }
        },
        updateUser: mockUpdateUser
    })
}));

vi.mock('../../../context/ThemeContext', () => ({
    useTheme: () => ({
        theme: 'light',
        systemTheme: 'light',
        setTheme: mockSetTheme
    })
}));

vi.mock('../../../lib/api', () => ({
    default: {
        get: vi.fn().mockResolvedValue({ data: { id: 'org-1', name: 'Test Org' } }),
    }
}));

vi.mock('../../../lib/factoryApi', () => ({
    listFactories: vi.fn().mockResolvedValue([])
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'en',
            changeLanguage: mockChangeLanguage
        }
    }),
    initReactI18next: {
        type: '3rdParty',
        init: vi.fn()
    }
}));

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
    useBlocker: () => ({ state: 'unblocked' })
}));

// Mock child components to simplify testing
vi.mock('../../components/common/LanguageSelector', () => ({
    LanguageSelector: ({ onPreferenceChange }: any) => (
        <select
            data-testid="language-selector"
            onChange={(e) => onPreferenceChange('locale', e.target.value)}
        >
            <option value="en-US">English</option>
            <option value="es-ES">Spanish</option>
        </select>
    )
}));

vi.mock('../../features/dashboard/components/LocationSelector', () => ({
    default: () => (
        <div data-testid="location-selector" />
    )
}));

describe('ProfilePage Preview Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should revert theme on unmount if not saved', () => {
        const { unmount } = render(<ProfilePage />);

        // Simulate changing theme to 'dark'
        const themeSelect = screen.getByRole('combobox', { name: /profile.fields.theme/i });
        fireEvent.change(themeSelect, { target: { value: 'dark' } });

        // Verify immediate preview
        expect(mockSetTheme).toHaveBeenCalledWith('dark');

        // Unmount (navigate away without saving)
        unmount();

        // Expect revert to original 'light'
        expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('should revert language on unmount if not saved', () => {
        const { unmount } = render(<ProfilePage />);

        // Simulate changing language to Spanish
        const langSelect = screen.getByTestId('language-selector');
        fireEvent.change(langSelect, { target: { value: 'es-ES' } });

        // Verify immediate preview (localeUtils converts es-ES to es)
        // Note: In test mock, we need to check what `toShortLocale` would do.
        // Assuming strict unit test, we might check if changeLanguage was called.
        // Based on ProfilePage logic: i18n.changeLanguage(toShortLocale(value))
        // 'es-ES' -> 'es' usually.
        expect(mockChangeLanguage).toHaveBeenCalledWith('es');

        // Unmount
        unmount();

        // Expect revert to original 'en'
        expect(mockChangeLanguage).toHaveBeenCalledWith('en');
    });

    it('should NOT revert to original if saved successfully', async () => {
        mockUpdateUser.mockResolvedValue({});
        const { unmount } = render(<ProfilePage />);

        // Change to Dark
        const themeSelect = screen.getByRole('combobox', { name: /profile.fields.theme/i });
        fireEvent.change(themeSelect, { target: { value: 'dark' } });

        // Click Save
        const saveBtn = screen.getByRole('button', { name: /profile.save_btn/i });
        fireEvent.click(saveBtn);

        await waitFor(() => {
            expect(mockUpdateUser).toHaveBeenCalled();
        });

        // Clear mocks to track what happens AFTER save
        mockSetTheme.mockClear();

        // Unmount
        unmount();

        // Should NOT call setTheme('light') because we saved 'dark'
        // Ideally it might call setTheme('dark') again or nothing if it matches current.
        // But specifically, it should NOT revert to 'light'.
        expect(mockSetTheme).not.toHaveBeenCalledWith('light');
    });

    it('Edge Case: Save -> Edit Again -> Revert to LAST SAVED', async () => {
        mockUpdateUser.mockResolvedValue({});
        const { unmount } = render(<ProfilePage />);

        // 1. Change to Dark
        const themeSelect = screen.getByRole('combobox', { name: /profile.fields.theme/i });
        fireEvent.change(themeSelect, { target: { value: 'dark' } });

        // 2. Save
        const saveBtn = screen.getByRole('button', { name: /profile.save_btn/i });
        fireEvent.click(saveBtn);
        await waitFor(() => expect(mockUpdateUser).toHaveBeenCalled());

        // 3. Clear mocks
        mockSetTheme.mockClear();

        // 4. Change to Light (Second Edit)
        fireEvent.change(themeSelect, { target: { value: 'light' } });
        expect(mockSetTheme).toHaveBeenCalledWith('light'); // Preview

        // 5. Unmount (Don't save the second edit)
        unmount();

        // 6. Expect Revert to DARK (the snapshot from step 2), NOT LIGHT (current) or LIGHT (original)
        expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
});
