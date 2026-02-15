/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

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
