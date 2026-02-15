/**
 * Auth Storage Utility
 * 
 * Single source of truth for authentication token and user storage.
 * All localStorage operations for auth should go through this module.
 */
import type { UserInfo } from './authApi';

const STORAGE_KEYS = {
    TOKEN: 'token',
    USER: 'user',
} as const;

export const authStorage = {
    // Token operations
    getToken: (): string | null => {
        return localStorage.getItem(STORAGE_KEYS.TOKEN);
    },

    setToken: (token: string): void => {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
    },

    removeToken: (): void => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
    },

    // User operations
    getUser: (): UserInfo | null => {
        const userStr = localStorage.getItem(STORAGE_KEYS.USER);
        if (!userStr) return null;
        try {
            return JSON.parse(userStr) as UserInfo;
        } catch {
            return null;
        }
    },

    setUser: (user: UserInfo): void => {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    },

    removeUser: (): void => {
        localStorage.removeItem(STORAGE_KEYS.USER);
    },

    // Combined operations
    isAuthenticated: (): boolean => {
        return !!localStorage.getItem(STORAGE_KEYS.TOKEN);
    },

    clear: (): void => {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
    },

    setAuth: (token: string, user: UserInfo): void => {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    },
};
