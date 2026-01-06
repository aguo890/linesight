import React from 'react';
import { type SmartWidgetProps } from '../config';
import { AlertOctagon, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import { DowntimeDataSchema } from '../registry';

// Infer types from Registry Schema
// The registry defines it as an object { reasons: [...] }
type DowntimeReasonsData = z.infer<typeof DowntimeDataSchema>;

interface BlockerItem {
    reason: string;
    count: number;
}

interface BlockerSettings {
    maxItems?: number;
    showCounts?: boolean;
    customTitle?: string;
}

const BlockerCloudWidget: React.FC<SmartWidgetProps<DowntimeReasonsData, BlockerSettings>> = ({
    data,
    settings
}) => {
    // Extract settings with defaults
    const maxItems = settings?.maxItems ?? 10;
    const showCounts = settings?.showCounts ?? true;

    // Helper to safely extract reasons array
    const extractReasons = (d: any): BlockerItem[] => {
        if (!d) return [];
        if (Array.isArray(d)) return d;
        if (d.reasons && Array.isArray(d.reasons)) return d.reasons;
        return [];
    };

    const reasons = extractReasons(data);

    if (reasons.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-2">
                    <AlertOctagon className="w-8 h-8 text-slate-200 mx-auto" />
                    <p className="text-xs text-slate-400">No downtime blockers detected today.</p>
                </div>
            </div>
        );
    }

    // Limit to maxItems
    const displayReasons = reasons.slice(0, maxItems);
    const maxCount = Math.max(...displayReasons.map(r => r.count));

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {displayReasons.map((item, idx) => (
                    <div key={idx} className="group">
                        <div className="flex justify-between items-center text-xs mb-1">
                            <span className="font-medium text-slate-700">{item.reason}</span>
                            {showCounts && (
                                <span className="text-slate-400">{item.count} occurrences</span>
                            )}
                        </div>
                        <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-red-400 rounded-full group-hover:bg-red-500 transition-all duration-500"
                                style={{ width: `${(item.count / maxCount) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-2 pt-2 border-t border-slate-50">
                <button className="text-[10px] text-sky-600 font-medium flex items-center hover:underline">
                    View all logs <ArrowRight className="w-3 h-3 ml-1" />
                </button>
            </div>
        </div>
    );
};

export default BlockerCloudWidget;


