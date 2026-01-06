// orval.config.ts
import { defineConfig } from 'orval';

export default defineConfig({
    // Main API client with React Query hooks + MSW mocks
    lineSightApi: {
        input: {
            target: './swagger.json',
        },
        output: {
            mode: 'tags-split',
            target: 'src/api/endpoints',
            schemas: 'src/api/model',
            client: 'react-query',
            mock: true,  // Generate MSW handlers
            override: {
                mutator: {
                    path: './src/api/axios-client.ts',
                    name: 'customInstance',
                },
            },
        },
    },

    // Zod schemas for runtime validation
    lineSightApiZod: {
        input: {
            target: './swagger.json',
        },
        output: {
            mode: 'single',
            target: 'src/api/zod-schemas.ts',
            client: 'zod',
        },
    },
});
