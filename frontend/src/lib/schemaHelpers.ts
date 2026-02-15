/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * Schema Helpers for Zod
 * 
 * Reusable Zod schema fragments for API response validation.
 * Eliminates duplication of .transform(parseFloat) patterns.
 */

import { z } from 'zod';
import { parseDecimal } from '@/types/decimal';

/**
 * Zod schema for a decimal value that comes from the backend
 * as either a string (Python Decimal) or number.
 * Automatically transforms to JavaScript number.
 * 
 * Usage:
 *   z.object({
 *     efficiency: decimalField,
 *     percentage: decimalField,
 *   })
 */
export const decimalField = z.union([z.number(), z.string()]).transform((val): number =>
    parseDecimal(val)
);

/**
 * Optional decimal field - same as decimalField but allows null/undefined.
 */
export const optionalDecimalField = z.union([z.number(), z.string(), z.null()])
    .optional()
    .transform((val): number | undefined =>
        val === null || val === undefined ? undefined : parseDecimal(val)
    );

/**
 * Decimal field with default value.
 */
export const decimalFieldWithDefault = (defaultValue: number) =>
    z.union([z.number(), z.string(), z.null()])
        .optional()
        .transform((val): number =>
            val === null || val === undefined ? defaultValue : parseDecimal(val)
        );

/**
 * Creates a decimal array schema - array of numbers that may come as strings.
 */
export const decimalArray = z.array(
    z.union([z.number(), z.string()]).transform((val): number => parseDecimal(val))
);
