/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { type UserPreferences, type User as UserType } from '@/lib/authApi';

// Helper to safely access preferences with default fallback
export const getPrefs = (user: UserType | null | undefined): UserPreferences => {
    return user?.preferences || {};
};
