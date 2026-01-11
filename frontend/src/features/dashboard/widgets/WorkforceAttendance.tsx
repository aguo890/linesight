import React from 'react';
import type { SmartWidgetProps } from '../config';
import { WorkforceDataSchema } from '../registry';
import { z } from 'zod';

// Infer TypeScript type from Zod schema
type WorkforceStats = z.infer<typeof WorkforceDataSchema>;

interface WorkforceSettings {
    showBreakdown?: boolean;
    customTitle?: string;
}

const WorkforceAttendanceCard: React.FC<SmartWidgetProps<WorkforceStats, WorkforceSettings>> = ({
    data,
    settings
}) => {
    // Settings
    const showBreakdown = settings?.showBreakdown ?? true;

    // Use API data or fallback
    const rawData = data || { present: 0, target: 0, absent: 0, late: 0 };

    // Compute derived values
    const attendanceRate = rawData.target > 0
        ? Math.round((rawData.present / rawData.target) * 100)
        : 0;

    return (
        <div className="h-full flex flex-col items-center justify-center flex-1">
            <div className="text-center mt-2">
                <div className="text-5xl font-bold text-text-main">{attendanceRate}%</div>
                <div className="text-xs text-text-muted font-medium mt-1">Attendance Rate</div>
            </div>

            {/* Breakdown */}
            {showBreakdown && (
                <div className="w-full mt-auto grid grid-cols-3 divide-x divide-border border-t border-border pt-4 pb-2">
                    <div className="text-center px-1">
                        <div className="text-lg font-bold text-brand">{rawData.present}</div>
                        <div className="text-[10px] text-text-muted uppercase">Present</div>
                    </div>
                    <div className="text-center px-1">
                        <div className="text-lg font-bold text-brand-dark">{rawData.target}</div>
                        <div className="text-[10px] text-text-muted uppercase">Target</div>
                    </div>
                    <div className="text-center px-1">
                        <div className="text-lg font-bold text-danger">{rawData.absent}</div>
                        <div className="text-[10px] text-text-muted uppercase">Absent</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkforceAttendanceCard;
