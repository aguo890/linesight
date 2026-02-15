/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { AlertOctagon, ArrowRight } from 'lucide-react';

interface BlockerItem {
    reason: string;
    count: number;
}

interface MockBlockerProps {
    w?: number;
    h?: number;
    data: BlockerItem[];
    isDark?: boolean;
}



export const MockBlockerCloudWidget: React.FC<MockBlockerProps> = ({ data, isDark = false }) => {
    const maxItems = 10;
    const showCounts = true;

    const reasons = data || [];

    // Limit to maxItems
    const displayReasons = reasons.slice(0, maxItems);
    const maxCount = Math.max(...displayReasons.map(r => r.count));

    return (
        <div className={`flex flex-col h-full w-full p-4 rounded-xl shadow-sm border transition-colors duration-300 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${isDark ? 'bg-red-900/40' : 'bg-red-50'}`}>
                        <AlertOctagon className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                        <h3 className={`text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Top Blockers</h3>
                        <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Recurring Downtime Keywords</div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                    {displayReasons.map((item, idx) => (
                        <div key={idx} className="group">
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{item.reason}</span>
                                {showCounts && (
                                    <span className={`${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.count} occurrences</span>
                                )}
                            </div>
                            <div className={`h-2 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-700' : 'bg-slate-50'}`}>
                                <div
                                    className="h-full bg-red-400 rounded-full group-hover:bg-red-500 transition-all duration-500"
                                    style={{ width: `${(item.count / maxCount) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                <div className={`mt-auto pt-2 border-t text-right ${isDark ? 'border-slate-700' : 'border-slate-50'}`}>
                    <button className="text-[10px] text-sky-600 font-medium inline-flex items-center hover:underline">
                        View all logs <ArrowRight className="w-3 h-3 ml-1 rtl:rotate-180" />
                    </button>
                </div>
            </div>
        </div>
    );
};
