/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { z } from 'zod';
import { getWidgetSchema, isValidWidgetType as isRegistryTypeValid, ALL_WIDGETS } from '../registry';

// --- Schema Definitions ---

export const WidgetConfigSchema = z.object({
    i: z.string(),
    widget: z.string(), // The normalized widget type
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
    settings: z.record(z.string(), z.any()).optional(),
});

export type ValidatedWidgetConfig = z.infer<typeof WidgetConfigSchema>;

// --- Constants ---
// Kept for legacy migration ID parsing only
const LEGACY_PREFIXES = [
    'production-chart', 'line-efficiency', 'dhu-quality', 'production-timeline',
    'sam-performance', 'workforce-attendance', 'upload-history', 'style-progress',
    'complexity-impact', 'speed-quality', 'target-realization', 'earned-minutes',
    'blocker-cloud'
];

// --- Validation Logic ---

/**
 * Validates settings for a specific widget instance against its strict Zod schema.
 * returns clean settings or defaults if validation fails.
 */
export function validateWidgetSettings(widgetId: string, settingsObject: any = {}): { isValid: boolean, cleanSettings: any, errors?: z.ZodError } {
    const schema = getWidgetSchema(widgetId);

    // If no schema found (unknown widget), return as-is but valid (or strict fail?)
    // For now, if we don't know the widget, we can't validate it, so we trust it or empty it.
    // Let's trust it but log specific warning if it's truly unknown.
    if (!schema || schema instanceof z.ZodAny) {
        return { isValid: true, cleanSettings: settingsObject };
    }

    const result = schema.safeParse(settingsObject);

    if (!result.success) {
        console.warn(`[WidgetService] Validation failed for ${widgetId}`, result.error);
        return { isValid: false, cleanSettings: {}, errors: result.error };
    }

    return { isValid: true, cleanSettings: result.data };
}

/**
 * Migration Helper: Attempts to merge old settings with new defaults.
 * Ensures missing fields in old data get default values from Zod.
 */
export function migrateLegacySettings(widgetId: string, oldSettings: any = {}) {
    const manifest = ALL_WIDGETS.find(w => w.id === widgetId);

    // If no manifest, nothing to migrate against
    if (!manifest) return oldSettings;

    let settings = { ...oldSettings };
    const savedVersion = settings.version || 0;
    const currentVersion = manifest.version;

    // Apply updates one by one (v1 -> v2 -> v3)
    if (savedVersion < currentVersion) {
        for (let v = savedVersion + 1; v <= currentVersion; v++) {
            if (manifest.migrations && manifest.migrations[v]) {
                try {
                    settings = manifest.migrations[v](settings);
                } catch (error) {
                    console.error(`[WidgetService] Migration failed for ${widgetId} v${v}`, error);
                    // Stop to prevent corruption
                    break;
                }
            }
        }
    }

    // Final stamp
    settings.version = currentVersion;

    // Strict Zod Validation
    const result = manifest.settingsSchema.safeParse(settings);

    if (result.success) {
        // [CRITICAL FIX] Force re-attach version in case Zod stripped it
        const finalOutput = result.data;
        finalOutput.version = currentVersion;
        return finalOutput;
    }

    console.warn(`[WidgetService] Validation failed for ${widgetId}, generating fresh defaults.`, result.error);

    // [ROBUSTNESS FIX] Generate defaults directly from the current source of truth (Zod)
    // instead of relying on potentially outdated manifest.initialSettings
    try {
        const cleanDefaults = manifest.settingsSchema.parse({});
        cleanDefaults.version = currentVersion;
        return cleanDefaults;
    } catch (e) {
        console.error(`[WidgetService] Critical: Failed to generate defaults for ${widgetId}`, e);
        return { version: currentVersion }; // Last resort fallback
    }
}


// --- Resolution Logic ---

/**
 * Resolves the widget type from a layout item.
 * Priority: 1. Explicit `widget` field → 2. Legacy ID prefix parsing
 */
export function resolveWidgetType(item: any): string {
    // 1. Preferred: Explicit type in config (Direct trust)
    if (item.widget) {
        return item.widget;
    }

    // 2. Fallback: Legacy ID parsing
    const id = item.i || item.widget_id;
    if (typeof id === 'string') {
        // Try matching against registry first (if ID matches a known type exact)
        if (isRegistryTypeValid(id)) return id;

        // Try matching against known legacy prefixes
        for (const prefix of LEGACY_PREFIXES) {
            if (id.startsWith(prefix)) {
                return prefix;
            }
        }

        // Last resort: Extract first segment before hyphen-uuid pattern
        const match = id.match(/^([a-z-]+?)(?:-[a-f0-9]{8})?$/i);
        if (match && match[1]) {
            return match[1];
        }
    }

    console.warn(`[WidgetService] Could not resolve type for item with ID: ${id}`);
    return 'unknown';
}

/**
 * One-time fixer: Converts a raw/legacy config into a ValidatedWidgetConfig.
 */
export function migrateLayoutConfig(rawItem: any): ValidatedWidgetConfig | null {
    try {
        const resolvedType = resolveWidgetType(rawItem);

        // Skip items that couldn't be resolved
        if (resolvedType === 'unknown') {
            console.error(`[WidgetService] Skipping unknown widget type for item:`, rawItem);
            return null;
        }

        // Ensure we have a valid ID
        const id = rawItem.i || rawItem.widget_id || `${resolvedType}-${crypto.randomUUID().slice(0, 8)}`;

        // STRICT VALIDATION STEP: Validate settings using the Registry
        const rawSettings = rawItem.settings || {};
        const cleanSettings = migrateLegacySettings(resolvedType, rawSettings);

        const migratedItem = {
            i: id,
            widget: resolvedType,
            x: Number(rawItem.x ?? 0),
            y: Number(rawItem.y ?? 0),
            w: Number(rawItem.w ?? 6),
            h: Number(rawItem.h ?? 6),
            settings: cleanSettings
        };

        // Final Structure Validation
        return WidgetConfigSchema.parse(migratedItem);
    } catch (error) {
        console.error(`[WidgetService] Failed to migrate item ${rawItem?.i}:`, error);
        return null;
    }
}

/**
 * Validates and migrates an array of configs.
 */
export function validateWidgetConfigs(configs: unknown[]): ValidatedWidgetConfig[] {
    if (!Array.isArray(configs)) {
        console.warn('[WidgetService] Expected array of configs, got:', typeof configs);
        return [];
    }

    const validated = configs
        .map(migrateLayoutConfig)
        .filter((item): item is ValidatedWidgetConfig => item !== null);

    const filtered = configs.length - validated.length;
    if (filtered > 0) {
        console.warn(`[WidgetService] Filtered ${filtered} corrupted widget(s) from layout`);
    }

    return validated;
}

/**
 * Checks if a widget type is valid/registered.
 */
export function isValidWidgetType(type: string): boolean {
    return isRegistryTypeValid(type);
}

