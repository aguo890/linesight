/**
 * useFactory Hook
 * 
 * Provides factory and production line data fetching with state management.
 * Encapsulates API calls and loading states from components.
 */
import { useState, useEffect, useCallback } from 'react';
import {
    listFactories,
    getFactory,
    listFactoryLines,
    createFactory as createFactoryApi,
    createProductionLine as createLineApi,
    deleteFactory as deleteFactoryApi,
    getProductionLine,
    type Factory,
    type ProductionLine,
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
    /** Production lines for this factory */
    lines: ProductionLine[];
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Create a new production line */
    createLine: (data: {
        name: string;
        code?: string;
        description?: string;
        specialty?: string;
    }) => Promise<ProductionLine>;
    /** Refresh factory and lines */
    refresh: () => Promise<void>;
}

export interface UseProductionLineReturn {
    /** Production line details */
    line: ProductionLine | null;
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Refresh line data */
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
            // Enrich with line count
            const enriched = await Promise.all(
                data.map(async (factory) => {
                    try {
                        const lines = await listFactoryLines(factory.id);
                        return { ...factory, lineCount: lines.length };
                    } catch {
                        return { ...factory, lineCount: 0 };
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
 * Hook for managing a single factory and its production lines.
 * 
 * @example
 * ```tsx
 * const { factory, lines, createLine } = useFactory(factoryId);
 * ```
 */
export function useFactory(factoryId: string | undefined): UseFactoryReturn {
    const [factory, setFactory] = useState<Factory | null>(null);
    const [lines, setLines] = useState<ProductionLine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadFactory = useCallback(async () => {
        if (!factoryId) {
            setFactory(null);
            setLines([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const [factoryData, linesData] = await Promise.all([
                getFactory(factoryId),
                listFactoryLines(factoryId),
            ]);
            setFactory(factoryData);
            setLines(linesData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load factory');
        } finally {
            setIsLoading(false);
        }
    }, [factoryId]);

    useEffect(() => {
        loadFactory();
    }, [loadFactory]);

    const createLine = useCallback(async (data: {
        name: string;
        code?: string;
        description?: string;
        specialty?: string;
    }): Promise<ProductionLine> => {
        if (!factoryId) throw new Error('Factory ID required');
        const line = await createLineApi(factoryId, data);
        await loadFactory(); // Refresh
        return line;
    }, [factoryId, loadFactory]);

    return {
        factory,
        lines,
        isLoading,
        error,
        createLine,
        refresh: loadFactory,
    };
}

// =============================================================================
// Production Line Hook
// =============================================================================

/**
 * Hook for managing a single production line.
 * 
 * @example
 * ```tsx
 * const { line, isLoading } = useProductionLine(lineId);
 * ```
 */
export function useProductionLine(lineId: string | undefined): UseProductionLineReturn {
    const [line, setLine] = useState<ProductionLine | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadLine = useCallback(async () => {
        if (!lineId) {
            setLine(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const data = await getProductionLine(lineId);
            setLine(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load production line');
        } finally {
            setIsLoading(false);
        }
    }, [lineId]);

    useEffect(() => {
        loadLine();
    }, [loadLine]);

    return {
        line,
        isLoading,
        error,
        refresh: loadLine,
    };
}
