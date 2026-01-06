import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { type Factory } from '../lib/factoryApi';
import { useListFactoriesApiV1FactoriesGet } from '../api/endpoints/factories/factories';

interface FactoryContextType {
    /** All available factories */
    factories: Factory[];
    /** ID of the currently active factory */
    activeFactoryId: string | null;
    /** The active factory object (derived) */
    activeFactory: Factory | null;
    /** Set the active factory manually */
    setActiveFactoryId: (id: string) => void;
    /** Loading state for factory list */
    isLoading: boolean;
    /** Error state */
    error: string | null;
}

export const FactoryContext = createContext<FactoryContextType | undefined>(undefined);

export const FactoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { data: factoriesData, isLoading, error: queryError } = useListFactoriesApiV1FactoriesGet();
    const [activeFactoryId, setActiveFactoryId] = useState<string | null>(null);

    const factories = (factoriesData as unknown as Factory[]) || [];
    const error = queryError ? (queryError as any).message || "Failed to load factories" : null;

    // Smart Default: Select first factory if none selected
    useEffect(() => {
        if (factories.length > 0 && !activeFactoryId) {
            // Ideally we might check localStorage here first in a real app
            setActiveFactoryId(factories[0].id);
        }
    }, [factories, activeFactoryId]);

    // 2. Derive Active Factory
    const activeFactory = useMemo(() => {
        return factories.find(f => f.id === activeFactoryId) || null;
    }, [factories, activeFactoryId]);

    const value = {
        factories,
        activeFactoryId,
        activeFactory,
        setActiveFactoryId,
        isLoading,
        error
    };

    return <FactoryContext.Provider value={value}>{children}</FactoryContext.Provider>;
};

// Hook for easy consumption
export const useFactoryContext = () => {
    const context = useContext(FactoryContext);
    if (!context) {
        throw new Error("useFactoryContext must be used within FactoryProvider");
    }
    return context;
};
