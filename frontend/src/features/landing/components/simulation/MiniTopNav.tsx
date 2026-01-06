import React from 'react';
import { Bell, Search, ChevronDown } from 'lucide-react';

export const MiniTopNav: React.FC = () => {
    return (
        <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-40 ml-64">
            {/* Search/Left Section */}
            <div className="flex items-center gap-4 flex-1">
                <div className="relative max-w-md w-full hidden md:block">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search factories, orders..."
                        disabled
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm transition-all cursor-default"
                        readOnly
                    />
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 md:gap-4">
                <button className="p-2 text-slate-500 rounded-lg relative cursor-default">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                </button>

                <div className="h-8 w-px bg-slate-200 mx-1"></div>

                {/* Mock User */}
                <div className="relative">
                    <button className="flex items-center gap-3 p-1 rounded-lg transition-colors cursor-default">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                            TD
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-slate-900 leading-tight">Tony DiNozzo</p>
                            <p className="text-xs text-slate-500 leading-tight">Plant Manager</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </div>
        </nav>
    );
};
