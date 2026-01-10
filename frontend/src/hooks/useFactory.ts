/**
 * useFactory Hook
 * 
 * Provides factory and data source fetching with state management.
 * Encapsulates API calls and loading states from components.
 */
import { useState, useEffect, useCallback } from 'react';
import {
    listFactories,
    getFactory,
    listDataSources,
    createFactory as createFactoryApi,
    createDataSource as createDataSourceApi,
    deleteFactory as deleteFactoryApi,
    getDataSource,
    type Factory,
    type DataSource,
} from '../lib/factoryApi';

// =============================================================================
// Types
// =============================================================================

export interface UseFactoriesReturn {
    /** List of all factories */
    factories: Factory[];
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Create a new factory */
    createFactory: (data: {
        name: string;
        code?: string;
        location?: string;
        country?: string;
        timezone?: string;
    }) => Promise<Factory>;
    /** Delete a factory */
    deleteFactory: (factoryId: string) => Promise<void>;
    /** Refresh factories list */
    refresh: () => Promise<void>;
}

export interface UseFactoryReturn {
    /** Factory details */
    factory: Factory | null;
    /** Data sources for this factory */
    dataSources: DataSource[];
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Create a new data source */
    createDataSource: (data: {
        source_name: string;
        name: string;
        code?: string;
        description?: string;
        specialty?: string;
    }) => Promise<DataSource>;
    /** Refresh factory and data sources */
    refresh: () => Promise<void>;
}

export interface UseDataSourceReturn {
    /** Data source details */
    dataSource: DataSource | null;
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Refresh data source data */
    refresh: () => Promise<void>;
}

// =============================================================================
// Factories List Hook
// =============================================================================

/**
 * Hook for managing the list of all factories.
 * 
 * @example
 * ```tsx
 * const { factories, createFactory, deleteFactory } = useFactories();
 * ```
 */
export function useFactories(): UseFactoriesReturn {
    const [factories, setFactories] = useState<Factory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadFactories = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await listFactories();
            // Enrich with source count
            const enriched = await Promise.all(
                data.map(async (factory) => {
                    try {
                        const sources = await listDataSources(factory.id);
                        return { ...factory, sourceCount: sources.length };
                    } catch {
                        return { ...factory, sourceCount: 0 };
                    }
                })
            );
            setFactories(enriched);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load factories');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFactories();
    }, [loadFactories]);

    const createFactory = useCallback(async (data: {
        name: string;
        code?: string;
        location?: string;
        country?: string;
        timezone?: string;
    }): Promise<Factory> => {
        const factory = await createFactoryApi(data);
        await loadFactories(); // Refresh list
        return factory;
    }, [loadFactories]);

    const deleteFactory = useCallback(async (factoryId: string): Promise<void> => {
        await deleteFactoryApi(factoryId);
        await loadFactories(); // Refresh list
    }, [loadFactories]);

    return {
        factories,
        isLoading,
        error,
        createFactory,
        deleteFactory,
        refresh: loadFactories,
    };
}

// =============================================================================
// Single Factory Hook
// =============================================================================

/**
 * Hook for managing a single factory and its data sources.
 * 
 * @example
 * ```tsx
 * const { factory, dataSources, createDataSource } = useFactory(factoryId);
 * ```
 */
export function useFactory(factoryId: string | undefined): UseFactoryReturn {
    const [factory, setFactory] = useState<Factory | null>(null);
    const [dataSources, setDataSources] = useState<DataSource[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadFactory = useCallback(async () => {
        if (!factoryId) {
            setFactory(null);
            setDataSources([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const [factoryData, sourcesData] = await Promise.all([
                getFactory(factoryId),
                listDataSources(factoryId),
            ]);
            setFactory(factoryData);
            setDataSources(sourcesData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load factory');
        } finally {
            setIsLoading(false);
        }
    }, [factoryId]);

    useEffect(() => {
        loadFactory();
    }, [loadFactory]);

    const createDataSource = useCallback(async (data: {
        source_name: string;
        name: string;
        code?: string;
        description?: string;
        specialty?: string;
    }): Promise<DataSource> => {
        if (!factoryId) throw new Error('Factory ID required');
        const source = await createDataSourceApi(factoryId, data);
        await loadFactory(); // Refresh
        return source;
    }, [factoryId, loadFactory]);

    return {
        factory,
        dataSources,
        isLoading,
        error,
        createDataSource,
        refresh: loadFactory,
    };
}

// =============================================================================
// Data Source Hook
// =============================================================================

/**
 * Hook for managing a single data source.
 * 
 * @example
 * ```tsx
 * const { dataSource, isLoading } = useDataSource(dataSourceId);
 * ```
 */
export function useDataSource(dataSourceId: string | undefined): UseDataSourceReturn {
    const [dataSource, setDataSource] = useState<DataSource | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadDataSource = useCallback(async () => {
        if (!dataSourceId) {
            setDataSource(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const data = await getDataSource(dataSourceId);
            setDataSource(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data source');
        } finally {
            setIsLoading(false);
        }
    }, [dataSourceId]);

    useEffect(() => {
        loadDataSource();
    }, [loadDataSource]);

    return {
        dataSource,
        isLoading,
        error,
        refresh: loadDataSource,
    };
}


