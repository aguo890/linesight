/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import api from '@/lib/api';

export interface SamPerformanceData {
    efficiency: number;
    efficiency_change: number;
    avg_sam_per_hour: number;
    total_sam: number;
}

export const getSamPerformance = async (lineId?: string): Promise<SamPerformanceData> => {
    const params = lineId ? { line_id: lineId } : {};
    // Ensure this matches the backend route defined in BE-013 or existing analytics routes
    const response = await api.get('/analytics/sam-performance', { params });
    return response.data;
};
