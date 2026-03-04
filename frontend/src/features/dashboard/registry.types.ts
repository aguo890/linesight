/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { z } from 'zod';

export type WidgetCategory = 'Efficiency' | 'Quality' | 'Workforce' | 'Operations';

export interface WidgetManifest<T = unknown> {
    id: string;
    meta: {
        title: string;
        description: string;
        category: WidgetCategory;
        tags: string[];
        priority?: number;
        icon: string;
        iconColor?: string;
        bgColor?: string;
    };
    layout: {
        w: number;
        h: number;
        minW: number;
        minH: number;
    };
    component: React.LazyExoticComponent<React.ComponentType<any>> | React.ComponentType<any>;
    settingsSchema: z.ZodSchema<T>;
    dataSchema?: z.ZodSchema<unknown>;
    initialSettings: T;
    dataId?: string;
    requirements?: {
        rawColumns?: string[];
        computedMetrics?: string[];
    };
    filterSubscription?: {
        dateRange?: boolean;
        shift?: boolean;
        productionLine?: boolean;
    };
    version: number;
    migrations?: Record<number, (settings: any) => any>;
    locked?: boolean;
}

export type BundleCategory = 'Recommended' | 'Operations' | 'Strategy';

export interface WidgetBundle {
    id: string;
    title: string;
    description: string;
    icon: string;
    widgetIds: string[];
    displayCategory: BundleCategory;
}

export interface BundleReadiness {
    isReady: boolean;
    percentage: number;
    supportedCount: number;
    totalCount: number;
    supportedWidgetIds: string[];
}

export interface CompatibilityStatus {
    status: 'supported' | 'near-miss' | 'unsupported' | 'locked';
    score: number;
    missingFields: string[];
}
