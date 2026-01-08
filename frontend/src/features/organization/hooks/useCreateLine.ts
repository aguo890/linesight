import { useCreateProductionLineApiV1FactoriesFactoryIdLinesPost } from '../../../api/endpoints/factories/factories';
import type { ProductionLineCreate } from '../../../api/model';

/**
 * Hook to create a production line in a factory.
 * Wraps the generated API hook for easier usage.
 */
export const useCreateLine = (factoryId: string) => {
    const { mutate, mutateAsync, ...rest } = useCreateProductionLineApiV1FactoriesFactoryIdLinesPost();

    const handleMutate = (data: ProductionLineCreate, options?: any) => {
        mutate({ factoryId, data }, options);
    };

    const handleMutateAsync = (data: ProductionLineCreate, options?: any) => {
        return mutateAsync({ factoryId, data }, options);
    };

    return {
        ...rest,
        mutate: handleMutate,
        mutateAsync: handleMutateAsync
    };
};
