/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Hook for fetching production lines grouped by factory.
 * 
 * TODO: Replace mock data with real API call to /api/v1/factories
 */

export interface ProductionLine {
    id: string;
    name: string;
}

export interface Factory {
    id: string;
    name: string;
    lines: ProductionLine[];
}

// ============================================================================
// MOCK DATA - Replace with API call in production
// ============================================================================
const MOCK_FACTORIES: Factory[] = [
    {
        id: 'f1',
        name: 'Dongguan Factory',
        lines: [
            { id: 'l1', name: 'Assembly Line A' },
            { id: 'l2', name: 'Assembly Line B' },
            { id: 'l3', name: 'Finishing Line' },
        ],
    },
    {
        id: 'f2',
        name: 'Shenzhen Plant',
        lines: [
            { id: 'l4', name: 'Production Line 1' },
            { id: 'l5', name: 'Production Line 2' },
        ],
    },
    {
        id: 'f3',
        name: 'Vietnam Facility',
        lines: [
            { id: 'l6', name: 'Main Assembly' },
        ],
    },
];

export interface UseProductionLinesResult {
    factories: Factory[];
    allLines: ProductionLine[];
    isLoading: boolean;
    error: Error | null;
}

/**
 * Fetches production lines grouped by factory.
 * Currently returns mock data for development.
 * 
 * @example
 * const { factories, allLines, isLoading } = useProductionLines();
 */
export function useProductionLines(): UseProductionLinesResult {
    // TODO: Replace with real API call using React Query
    // const { data, isLoading, error } = useQuery(['factories'], fetchFactories);

    const allLines = MOCK_FACTORIES.flatMap((factory) =>
        factory.lines.map((line) => ({
            ...line,
            // Prefix with factory name for clarity in dropdowns
            name: `${factory.name} → ${line.name}`,
        }))
    );

    return {
        factories: MOCK_FACTORIES,
        allLines,
        isLoading: false,
        error: null,
    };
}
