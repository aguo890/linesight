import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getQuotaStatus, type QuotaStatus } from '@/lib/quotaApi';

interface OrganizationContextType {
    quotaStatus: QuotaStatus | null;
    isLoading: boolean;
    error: string | null;
    refreshQuota: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export const OrganizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshQuota = useCallback(async () => {
        // Don't set loading to true on refresh to avoid UI flicker
        setError(null);
        try {
            const data = await getQuotaStatus();
            setQuotaStatus(data);
        } catch (err: any) {
            console.error('Failed to load quota status:', err);
            // Only set error if we don't have data yet, or depending on UX preference
            if (!quotaStatus) {
                setError(err.response?.status === 401 ? 'Not logged in' : 'Failed to load organization data');
            }
        } finally {
            setIsLoading(false);
        }
    }, [quotaStatus]);

    useEffect(() => {
        // Initial load
        refreshQuota();
    }, []);

    const value = {
        quotaStatus,
        isLoading,
        error,
        refreshQuota
    };

    return (
        <OrganizationContext.Provider value={value}>
            {children}
        </OrganizationContext.Provider>
    );
};

export const useOrganization = () => {
    const context = useContext(OrganizationContext);
    if (context === undefined) {
        throw new Error('useOrganization must be used within an OrganizationProvider');
    }
    return context;
};
