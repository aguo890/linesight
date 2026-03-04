/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { type UserInfo, type UserUpdate } from '@/lib/authApi';

export interface AuthState {
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
