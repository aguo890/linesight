/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Bell, Search, ChevronDown } from 'lucide-react';

export const MiniTopNav: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
    return (
        <nav className={`h-16 border-b flex items-center justify-between px-4 sticky top-0 z-40 ml-64 transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            {/* Search/Left Section */}
            <div className="flex items-center gap-4 flex-1">
                <div className="relative max-w-md w-full hidden md:block">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search factories, orders..."
                        disabled
                        className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm transition-all cursor-default ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                        readOnly
                    />
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 md:gap-4">
                <button className={`p-2 rounded-lg relative cursor-default ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Bell className="w-5 h-5" />
                    <span className={`absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 ${isDark ? 'border-slate-900' : 'border-white'}`}></span>
                </button>

                <div className={`h-8 w-px mx-1 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}></div>

                {/* Mock User */}
                <div className="relative">
                    <button className="flex items-center gap-3 p-1 rounded-lg transition-colors cursor-default">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                            TD
                        </div>
                        <div className="hidden md:block text-left">
                            <p className={`text-sm font-medium leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>Tony DiNozzo</p>
                            <p className={`text-xs leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Plant Manager</p>
                        </div>
                        <ChevronDown className={`w-4 h-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                    </button>
                </div>
            </div>
        </nav>
    );
};
