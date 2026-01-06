import { type UserPreferences, type User as UserType } from '../../lib/authApi';

// Helper to safely access preferences with default fallback
export const getPrefs = (user: UserType | null | undefined): UserPreferences => {
    return user?.preferences || {};
};
