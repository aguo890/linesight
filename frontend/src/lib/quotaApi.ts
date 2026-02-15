/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Organization and quota API client
 */
import api from './api';

export interface QuotaStatus {
    subscription_tier: 'starter' | 'pro' | 'enterprise';
    factories: {
        current: number;
        max: number;
        available: number;
        can_create: boolean;
    };
    lines_per_factory: {
        max: number;
        by_factory: Array<{
            factory_id: string;
            factory_name: string;
            current: number;
            available: number;
            can_create: boolean;
        }>;
    };
}

export const getQuotaStatus = async (): Promise<QuotaStatus> => {
    const response = await api.get<QuotaStatus>('/organizations/quota-status');
    return response.data;
};
