import { getPrefs } from './utils';
import { type User as UserType } from '@/lib/authApi';

// Mock User type for testing
const mockUser = (prefs: any): UserType => ({
    id: '123',
    email: 'test@example.com',
    full_name: 'Test User',
    role: 'viewer',
    organization_id: 'org1',
    preferences: prefs
});

describe('getPrefs', () => {
    it('returns empty object for null user', () => {
        expect(getPrefs(null)).toEqual({});
    });

    it('returns empty object for user with no preferences', () => {
        expect(getPrefs(mockUser(undefined))).toEqual({});
    });

    it('returns object when prefs is already an object', () => {
        const prefs = { theme: 'dark' };
        expect(getPrefs(mockUser(prefs))).toEqual({ theme: 'dark' });
    });

    // Removed string parsing tests as backend now guarantees object
});
