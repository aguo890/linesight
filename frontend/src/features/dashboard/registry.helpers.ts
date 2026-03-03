/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import {
    type WidgetManifest,
    type CompatibilityStatus,
    type BundleReadiness
} from './registry.types';
import { LEGACY_ALIASES, WIDGET_BUNDLES } from './registry.constants';

/**
 * Note: These helpers will be populated by the registry implementation.
 * We use a "deferred" approach or passing the manifests array to avoid circular dependencies.
 */

export const getWidgetManifest = (id: string, allWidgets: WidgetManifest[]): WidgetManifest | undefined => {
    return allWidgets.find(w => w.id === id);
};

export const getCompatibilityStatus = (widgetId: string, activeFields: string[], allWidgets: WidgetManifest[]): CompatibilityStatus => {
    const manifest = getWidgetManifest(widgetId, allWidgets);
    if (!manifest) return { status: 'unsupported', score: 0, missingFields: [] };

    const requirements = manifest.requirements || {};

    // Mock metric checker for now - in real usage this would check against the datasource schema
    const isMetricAvailable = (metric: string) => activeFields.includes(metric);

    const missingRaw = (requirements.rawColumns || [])
        .filter(col => !activeFields.includes(col));

    const missingComputed = (requirements.computedMetrics || [])
        .filter(m => !isMetricAvailable(m));

    const missingAll = [...missingRaw, ...missingComputed];
    const totalRequired = (requirements.rawColumns?.length || 0) +
        (requirements.computedMetrics?.length || 0);

    const score = totalRequired === 0 ? 1 : (totalRequired - missingAll.length) / totalRequired;

    let status: CompatibilityStatus['status'] = 'locked';
    if (manifest.locked) status = 'locked';
    else if (score === 1) status = 'supported';
    else if (missingAll.length === 1) status = 'near-miss';

    return { status, score, missingFields: missingAll };
};

export const getBundleReadiness = (bundleId: string, activeFields: string[], allWidgets: WidgetManifest[]): BundleReadiness => {
    const bundle = WIDGET_BUNDLES.find(b => b.id === bundleId);
    if (!bundle) return { isReady: false, percentage: 0, supportedCount: 0, totalCount: 0, supportedWidgetIds: [] };

    const activeWidgetIds = bundle.widgetIds.filter(id => {
        const manifest = getWidgetManifest(id, allWidgets);
        return manifest && !manifest.locked;
    });

    const supportedWidgetIds = activeWidgetIds.filter(id => {
        const { status } = getCompatibilityStatus(id, activeFields, allWidgets);
        return status === 'supported';
    });

    const supportedCount = supportedWidgetIds.length;
    const totalCount = activeWidgetIds.length;

    return {
        isReady: totalCount > 0 && supportedCount === totalCount,
        percentage: totalCount > 0 ? Math.round((supportedCount / totalCount) * 100) : 0,
        supportedCount,
        totalCount,
        supportedWidgetIds
    };
};

export const getWidgetLayout = (widgetType: string, x: number, y: number, allWidgets: WidgetManifest[]) => {
    const manifest = getWidgetManifest(widgetType, allWidgets);
    const targetId = manifest ? widgetType : LEGACY_ALIASES[widgetType];
    const resolvedManifest = targetId ? getWidgetManifest(targetId, allWidgets) : undefined;

    const def = resolvedManifest?.layout;
    const defaultDimensions = { w: 6, h: 6, minW: 4, minH: 4 };

    return {
        i: `${widgetType}-${crypto.randomUUID().slice(0, 8)}`,
        widget: widgetType,
        x,
        y,
        w: def?.w ?? defaultDimensions.w,
        h: def?.h ?? defaultDimensions.h,
        minW: def?.minW ?? defaultDimensions.minW,
        minH: def?.minH ?? defaultDimensions.minH,
    };
};
