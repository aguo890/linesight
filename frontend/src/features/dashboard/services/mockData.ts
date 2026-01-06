import type { GlobalFilters } from '../config';

// Types needed for mocks
export interface ProductionDataPoint {
    time: string;
    actual: number;
    target: number;
}

export interface EfficiencyDataPoint {
    time: string;
    efficiency: number;
    trend: number;
}

export interface DowntimeDataPoint {
    reason: string;
    count: number;
}

// ============================================================================
// Mock Data Generators
// ============================================================================

export const getProductionData = (filters: GlobalFilters) => {
    const isShiftB = filters.shift === 'Shift B';
    const base = isShiftB ? 400 : 800;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Return object with data_points to match API response shape
    const data_points = days.map((day) => {
        const target = 900;
        const actual = Math.floor(base + Math.random() * 150);
        return {
            day,
            actual,
            target
        };
    });

    return {
        data_points,
        line_filter: null
    };
};

export const getEfficiencyData = (filters: GlobalFilters): EfficiencyDataPoint[] => {
    const isYesterday = filters.dateRange.start.getDate() !== new Date().getDate();
    const baseEff = isYesterday ? 75 : 92;

    return Array.from({ length: 8 }, (_, i) => ({
        time: `${i + 8}:00`,
        efficiency: Math.round((baseEff + Math.random() * 8) * 10) / 10,
        trend: baseEff,
    }));
};

export const getRealizationData = (filters: GlobalFilters) => {
    const isShiftB = filters.shift === 'Shift B';
    // Shift B is behind target in this mock
    return [{
        actual: isShiftB ? 420 : 850,
        target: isShiftB ? 500 : 800,
        percentage: isShiftB ? 84 : 106,
        delta: isShiftB ? -80 : 50
    }];
};

export const getQualityCategoryData = (_filters: GlobalFilters) => {
    // Generate random DHU bars
    return [
        { category: 'Stitching', dhu: 2.1 },
        { category: 'Fabric', dhu: 0.8 },
        { category: 'Finishing', dhu: 1.5 },
        { category: 'Packing', dhu: 0.2 },
    ];
};

// Matches backend WorkforceStats Pydantic model
export const getWorkforceData = (filters: GlobalFilters) => {
    const isShiftA = filters.shift === 'Shift A' || filters.shift === 'ALL' || filters.shift === 'Morning';
    const present = isShiftA ? 54 : 45;
    const target = 60;
    return {
        present,
        target,
        absent: target - present,
        late: isShiftA ? 1 : 3
    };
};

export const getEarnedMinutesData = (filters: GlobalFilters) => {
    const isToday = filters.dateRange.start.getDate() === new Date().getDate();
    // Mock aggregate stats matching API response shape
    const earned = isToday ? 65557.5 : 52000.0;
    const available = isToday ? 53280.0 : 48000.0;
    const efficiency = available > 0 ? (earned / available) * 100 : 0;

    return {
        earned_minutes: earned,
        total_available_minutes: available,
        efficiency_pct_aggregate: parseFloat(efficiency.toFixed(2))
    };
};

export const getSpeedQualityData = (filters: GlobalFilters) => {
    const isShiftB = filters.shift === 'Shift B';
    return Array.from({ length: 20 }, (_, i) => ({
        id: `Line ${i + 1}`,
        sam: Math.floor(10 + Math.random() * 30),           // Complexity (SAM minutes) - matches widget XAxis
        efficiency: Math.floor(75 + Math.random() * 30) + (isShiftB ? -5 : 0), // Efficiency % - matches widget YAxis
        volume: Math.floor(50 + Math.random() * 200),       // Production volume - matches widget ZAxis
    }));
};

export const getTimelineData = (filters: GlobalFilters) => {
    const isShiftB = filters.shift === 'Shift B';
    const startHour = isShiftB ? 16 : 8; // Shift A starts 8am, Shift B starts 4pm

    // Generate 8 hours of timeline data
    return Array.from({ length: 9 }, (_, i) => {
        const hour = startHour + i;
        const timeLabel = `${hour > 23 ? hour - 24 : hour}:00`;

        // Simulate a "lunch dip" in the middle
        const isLunch = i === 4;
        const output = isLunch ? 20 : Math.floor(100 + Math.random() * 50);

        return {
            time: timeLabel,
            actual: output,
            target: 120, // Hourly target
            variance: output - 120
        };
    });
};

// Matches backend StyleProgressResponse Pydantic model
export const getStyleData = (_filters: GlobalFilters) => {
    return {
        active_styles: [
            { style_code: 'ST-24-001', target: 5000, actual: 4200, progress_pct: 84, status: 'On Track' },
            { style_code: 'ST-24-005', target: 3000, actual: 850, progress_pct: 28, status: 'Behind' },
            { style_code: 'ST-24-008', target: 2500, actual: 2450, progress_pct: 98, status: 'Completed' },
            { style_code: 'ST-24-012', target: 10000, actual: 1200, progress_pct: 12, status: 'On Track' },
        ]
    };
};

export const getComplexityData = (_filters: GlobalFilters) => {
    return Array.from({ length: 15 }, (_, i) => {
        const sam = 10 + Math.random() * 30;
        const efficiency = 100 - (sam * 1.2) + (Math.random() * 10);
        return {
            style_number: `Style ${String.fromCharCode(65 + i)}`, // Match Widget dataKey="style_number"
            sam: parseFloat(sam.toFixed(1)),
            efficiency: parseFloat(efficiency.toFixed(1)),       // Match Widget dataKey="efficiency"
            volume: Math.floor(100 + Math.random() * 500)
        };
    });
};

export const getDowntimeData = (filters: GlobalFilters): DowntimeDataPoint[] => {
    const isShiftB = filters.shift === 'Shift B';
    // Shift B has more material issues
    const reasons = [
        { reason: 'Machine Failure', count: isShiftB ? 5 : 12 },
        { reason: 'Material Shortage', count: isShiftB ? 15 : 4 },
        { reason: 'Operator Absence', count: 3 },
        { reason: 'Quality Check', count: 8 },
        { reason: 'Power Outage', count: 1 }
    ];
    return reasons.sort((a, b) => b.count - a.count);
};

export const getSamPerformanceData = (_filters: GlobalFilters) => {
    const operators = ['Op A', 'Op B', 'Op C', 'Op D', 'Op E'];
    return {
        efficiency: 92,
        efficiency_change: 2.5,
        avg_sam_per_hour: 45,
        total_sam: 360,
        breakdown: operators.map(op => ({
            name: op,
            actual: Math.floor(Math.random() * 150) + 300,
            standard: 400,
            efficiency: Math.floor(Math.random() * 20) + 80
        }))
    };
};

export const getUploadHistoryData = (_filters: GlobalFilters) => {
    return [
        { id: 1, file: 'prod_cy_2023.csv', date: '2023-10-25 09:00', status: 'Success', user: 'Admin' },
        { id: 2, file: 'shifts_update.xlsx', date: '2023-10-25 08:30', status: 'Processing', user: 'Sys' },
        { id: 3, file: 'inv_log_err.txt', date: '2023-10-24 16:45', status: 'Failed', user: 'J.Doe' },
    ];
};

export const getKpiSummaryData = (filters: GlobalFilters) => {
    const isShiftB = filters.shift === 'Shift B';
    const isEvening = filters.shift === 'Evening';

    // Vary base numbers by shift to verify filtering
    const baseOutput = isShiftB ? 4500 : (isEvening ? 3200 : 8500);
    const baseEff = isShiftB ? 78 : (isEvening ? 82 : 94);

    return {
        totalOutput: baseOutput + Math.floor(Math.random() * 500),
        efficiency: baseEff + Math.floor(Math.random() * 4),
        oee: Math.floor(baseEff * 0.85),
        trends: {
            output: isShiftB ? -5 : 12,
            efficiency: isShiftB ? -2 : 4,
            oee: 1
        }
    };
};

// V2 Mock Data for Line Efficiency Gauge
export const getEfficiencyKpiData = (_filters: GlobalFilters) => {
    const current = 78.5 + (Math.random() * 10);
    const target = 85;
    const trend = (Math.random() - 0.5) * 5; // -2.5 to +2.5
    let status: 'on-track' | 'at-risk' | 'behind';

    if (current >= target) status = 'on-track';
    else if (current >= target - 5) status = 'at-risk';
    else status = 'behind';

    return {
        currentEfficiency: parseFloat(current.toFixed(1)),
        targetEfficiency: target,
        trend: parseFloat(trend.toFixed(1)),
        status,
    };
};

// V2 Mock Data for DHU Quality Chart
// Returns array of {date, dhu} to match API response
export const getDhuHistoryData = (_filters: GlobalFilters) => {
    const dates = [
        '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04',
        '2026-01-05', '2026-01-06', '2026-01-07'
    ];

    // Return array directly to match API response
    return dates.map(date => ({
        date,
        dhu: parseFloat((1.5 + Math.random() * 1.5).toFixed(2))
    }));
};
