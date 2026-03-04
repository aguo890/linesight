/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { type WidgetBundle } from './registry.types';

export const LEGACY_ALIASES: Record<string, string> = {
    'style': 'style-progress',
    'complexity': 'complexity-impact',
    'speed': 'speed-quality',
    'target': 'target-realization',
    'earned': 'earned-minutes',
    'blocker': 'blocker-cloud'
};

export const WIDGET_BUNDLES: WidgetBundle[] = [
    {
        id: 'efficiency-starter',
        title: 'widgets.bundles.efficiency_starter.title',
        description: 'widgets.bundles.efficiency_starter.description',
        icon: 'Zap',
        widgetIds: ['production-chart', 'line-efficiency', 'target-realization', 'production-timeline'],
        displayCategory: 'Recommended'
    },
    {
        id: 'quality-auditor',
        title: 'widgets.bundles.quality_auditor.title',
        description: 'widgets.bundles.quality_auditor.description',
        icon: 'ShieldCheck',
        widgetIds: ['dhu-quality', 'speed-quality', 'blocker-cloud'],
        displayCategory: 'Operations'
    },
    {
        id: 'floor-manager',
        title: 'widgets.bundles.floor_manager.title',
        description: 'widgets.bundles.floor_manager.description',
        icon: 'Users',
        widgetIds: ['production-chart', 'workforce-attendance', 'earned-minutes', 'style-progress'],
        displayCategory: 'Recommended'
    },
    {
        id: 'executive-summary',
        title: 'widgets.bundles.executive_summary.title',
        description: 'widgets.bundles.executive_summary.description',
        icon: 'TrendingUp',
        widgetIds: ['line-efficiency', 'dhu-quality', 'target-realization'],
        displayCategory: 'Strategy'
    }
];
