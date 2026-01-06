import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createProductionLine } from '../../../lib/factoryApi';
import { getListProductionLinesApiV1FactoriesFactoryIdLinesGetQueryKey } from '../../../api/endpoints/factories/factories';

/**
 * Custom hook to create a production line with optimistic updates (Zero Latency UI)
 */
export const useCreateLine = (factoryId: string) => {
    const queryClient = useQueryClient();
    const queryKey = getListProductionLinesApiV1FactoriesFactoryIdLinesGetQueryKey(factoryId);

    return useMutation({
        mutationFn: (data: { name: string; code?: string; description?: string; specialty?: string; settings?: any }) =>
            createProductionLine(factoryId, data),

        // 1. Optimistic Update (Run immediately)
        onMutate: async (newLineData) => {
            // Cancel any outgoing refetches so they don't overwrite our optimistic update
            await queryClient.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previousLines = queryClient.getQueryData(queryKey);

            // Optimistically update to the new value
            queryClient.setQueryData(queryKey, (old: any[] | undefined) => {
                const tempId = `temp-${Math.random()}`;
                const optimistLine = {
                    id: tempId,
                    factory_id: factoryId,
                    name: newLineData.name,
                    code: newLineData.code,
                    description: newLineData.description,
                    specialty: newLineData.specialty,
                    is_active: true,
                    isOptimistic: true // Flag for UI styling if needed
                };

                return old ? [...old, optimistLine] : [optimistLine];
            });

            // Return context with the snapped value
            return { previousLines };
        },

        // 2. If the request fails, roll back
        onError: (_err, _newLine, context) => {
            if (context?.previousLines) {
                queryClient.setQueryData(queryKey, context.previousLines);
            }
        },

        // 3. Always refetch after error or success to ensure server sync
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey });
        },
    });
};
