import api from './api';

export interface QuotaStatus {
    subscription_tier: string;
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
    const response = await api.get('/organizations/quota-status');
    return response.data;
};
