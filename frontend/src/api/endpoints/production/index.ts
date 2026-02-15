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
