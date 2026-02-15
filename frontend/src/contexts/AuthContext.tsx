/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import api from '@/lib/api';
import { authStorage } from '@/lib/authStorage';
import { updateProfile, type UserUpdate, type UserInfo } from '@/lib/authApi';
import i18n from '../i18n';
import { toShortLocale, detectBestLocale } from '../utils/localeUtils';

interface AuthState {
    user: UserInfo | null;
    token: string | null;
    isAuthenticated: boolean;
}

export interface AuthContextType extends AuthState {
    login: (email: string, password: string) => Promise<UserInfo>;
    loginDemo: (email: string) => void;
    logout: () => void;
    updateUser: (data: UserUpdate) => Promise<UserInfo>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [authState, setAuthState] = useState<AuthState>(() => {
        const token = authStorage.getToken();
        const user = authStorage.getUser();
        return {
            token,
            user,
            isAuthenticated: !!token,
        };
    });

    // Detect and apply user's preferred language on load or change
    useEffect(() => {
        const targetLocale = authState.user?.preferences?.locale || detectBestLocale();
        const shortLocale = toShortLocale(targetLocale);
        if (i18n.language !== shortLocale) {
            i18n.changeLanguage(shortLocale);
        }
    }, [authState.user]);

    const login = useCallback(async (email: string, password: string) => {
        const response = await api.post('/auth/login', { email, password });
        const { access_token, user } = response.data;

        authStorage.setAuth(access_token, user);

        setAuthState({
            token: access_token,
            user,
            isAuthenticated: true,
        });

        return user;
    }, []);

    const loginDemo = useCallback((email: string) => {
        const token = 'demo-token-123';
        const user: UserInfo = {
            id: '1',
            email,
            full_name: 'Demo User',
            role: 'admin',
            organization_id: 'org-1'
        };

        authStorage.setAuth(token, user);

        setAuthState({
            token,
            user,
            isAuthenticated: true,
        });
    }, []);

    const updateUser = useCallback(async (data: UserUpdate) => {
        const updatedUser = await updateProfile(data);
        setAuthState(prev => ({
            ...prev,
            user: { ...prev.user, ...updatedUser }
        }));
        return updatedUser;
    }, []);

    const logout = useCallback(() => {
        authStorage.clear();
        setAuthState({
            token: null,
            user: null,
            isAuthenticated: false,
        });
    }, []);

    const value = {
        ...authState,
        login,
        loginDemo,
        logout,
        updateUser,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
