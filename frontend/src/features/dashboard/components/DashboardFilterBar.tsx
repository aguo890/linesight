import React, { useState } from 'react';
import { Filter } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { useFactoryFormat } from '@/hooks/useFactoryFormat';
import { useTimezoneDate } from '@/hooks/useTimezoneDate';
import { useFactoryContext } from '@/contexts/FactoryContext';
import { TimezoneDateRangePicker } from '@/components/common/TimezoneDateRangePicker';

export const DashboardFilterBar: React.FC = () => {
    // Consume Global Context
    const { globalFilters, updateDateRange, updateShift, triggerRefresh, lastRefreshAt } = useDashboard();
    const { activeFactory } = useFactoryContext();
    const { shift } = globalFilters;
    const { formatDate } = useFactoryFormat();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Resolve Timezone: Priority to Active Factory, fallback to UTC
    const factoryTimezone = activeFactory?.settings?.timezone || 'UTC';

    // Consume Timezone Hook with Explicit Timezone (for Quick Actions logic)
    const {
        getFactoryStartOfToday,
        getFactoryEndOfToday,
        subtractFactoryDays,
        getEndOfFactoryDay,
        toFactoryDateInputValue,
        fromFactoryDateInputValue
    } = useTimezoneDate(factoryTimezone);

    // Default to "Today" if no range is set
    const currentStart = globalFilters.dateRange?.start || getFactoryStartOfToday();
    const currentEnd = globalFilters.dateRange?.end || getFactoryEndOfToday();

    const handleRefresh = () => {
        setIsRefreshing(true);
        triggerRefresh();
        // Reset animation after 1s
        setTimeout(() => setIsRefreshing(false), 1000);
    };

    // Helper: Update Date Range safely
    const handleUpdateDateRange = (start: Date, end: Date) => {
        updateDateRange({ from: start, to: end });
    };

    // --- Quick Action Logics ---

    // TODAY
    const setToday = () => {
        const start = getFactoryStartOfToday();
        const end = getFactoryEndOfToday();
        updateDateRange({ from: start, to: end });
    };
    const isToday = () => {
        const checkStart = getFactoryStartOfToday();
        const checkEnd = getFactoryEndOfToday();
        return currentStart?.getTime() === checkStart.getTime() && currentEnd?.getTime() === checkEnd.getTime();
    };

    // YESTERDAY
    const setYesterday = () => {
        const todayStart = getFactoryStartOfToday();
        const yesterdayStart = subtractFactoryDays(todayStart, 1);
        const yesterdayEnd = getEndOfFactoryDay(yesterdayStart);
        updateDateRange({ from: yesterdayStart, to: yesterdayEnd });
    };
    const isYesterday = () => {
        const todayStart = getFactoryStartOfToday();
        const checkStart = subtractFactoryDays(todayStart, 1);
        return currentStart?.getTime() === checkStart.getTime() && !isToday(); // Simple check relying on start matching
    };

    // LAST 7 DAYS
    const setLast7Days = () => {
        const todayStart = getFactoryStartOfToday();
        const start = subtractFactoryDays(todayStart, 6); // 7 days inclusive: [Today-6, Today]
        const end = getFactoryEndOfToday();
        updateDateRange({ from: start, to: end });
    };
    const isLast7Days = () => {
        const todayStart = getFactoryStartOfToday();
        const checkStart = subtractFactoryDays(todayStart, 6);
        const checkEnd = getFactoryEndOfToday();
        return currentStart?.getTime() === checkStart.getTime() && currentEnd?.getTime() === checkEnd.getTime();
    };

    // LAST 30 DAYS
    const setLast30Days = () => {
        const todayStart = getFactoryStartOfToday();
        const start = subtractFactoryDays(todayStart, 29); // 30 days inclusive
        const end = getFactoryEndOfToday();
        updateDateRange({ from: start, to: end });
    };
    const isLast30Days = () => {
        const todayStart = getFactoryStartOfToday();
        const checkStart = subtractFactoryDays(todayStart, 29);
        const checkEnd = getFactoryEndOfToday();
        return currentStart?.getTime() === checkStart.getTime() && currentEnd?.getTime() === checkEnd.getTime();
    };

    // THIS MONTH
    const setThisMonth = () => {
        const todayStart = getFactoryStartOfToday(); // UTC Date representing Factory 00:00
        const todayStr = toFactoryDateInputValue(todayStart); // "YYYY-MM-DD"

        // Construct "YYYY-MM-01"
        const [y, m] = todayStr.split('-');
        const startOfMonthStr = `${y}-${m}-01`;

        const start = fromFactoryDateInputValue(startOfMonthStr);

        // End of This Month logic? Usually users want "Month to Date" (up to today) or proper "End of Month".
        // Let's go with "Month to Date" (Up to Today end) OR "Whole Month" (Up to actual end of month)?
        // Use "Start of Month" to "End of Today" for practical dashboarding (Month-to-Date).
        // If user wants full month they can pick dates manually or we calculate end of month.
        // Let's do End of Month to be consistent with "Filter by Month" concept.

        // Calculate End of Month:
        // Jump to next month 1st, subtract 1 day.
        // Helper: safe string math
        let nextM = parseInt(m) + 1;
        let nextY = parseInt(y);
        if (nextM > 12) { nextM = 1; nextY++; }

        const nextMonthStartStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
        const nextMonthStart = fromFactoryDateInputValue(nextMonthStartStr);
        if (!nextMonthStart || !start) return;

        // End of This Month = (Start of Next Month) - 1 day (at end of day)
        // Actually `useTimezoneDate` doesn't give us `subtractDays` from arbitrary date easily without helper?
        // We have `subtractFactoryDays`.
        const endOfMonthStart = subtractFactoryDays(nextMonthStart, 1);
        const end = getEndOfFactoryDay(endOfMonthStart);

        updateDateRange({ from: start, to: end });
    };
    const isThisMonth = () => {
        // Re-calculate the target range to compare
        const todayStart = getFactoryStartOfToday();
        const todayStr = toFactoryDateInputValue(todayStart);
        const [y, m] = todayStr.split('-');
        const startOfMonthStr = `${y}-${m}-01`;
        const start = fromFactoryDateInputValue(startOfMonthStr);

        // Similar recalc for end... this is getting expensive to run on every render?
        // It's fine for simple string ops.
        let nextM = parseInt(m) + 1;
        let nextY = parseInt(y);
        if (nextM > 12) { nextM = 1; nextY++; }
        const nextMonthStartStr = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
        const nextMonthStart = fromFactoryDateInputValue(nextMonthStartStr);

        if (!start || !nextMonthStart) return false;

        const endOfMonthStart = subtractFactoryDays(nextMonthStart, 1);
        const end = getEndOfFactoryDay(endOfMonthStart);

        return currentStart?.getTime() === start.getTime() && currentEnd?.getTime() === end.getTime();
    };

    // LAST MONTH
    const setLastMonth = () => {
        const todayStart = getFactoryStartOfToday();
        const todayStr = toFactoryDateInputValue(todayStart); // "2023-10-25"
        const [y, m] = todayStr.split('-');

        let prevM = parseInt(m) - 1;
        let prevY = parseInt(y);
        if (prevM < 1) { prevM = 12; prevY--; }

        const startOfPrevMonthStr = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
        const start = fromFactoryDateInputValue(startOfPrevMonthStr);

        // End of Prev Month
        const startOfThisMonthStr = `${y}-${m}-01`;
        const startOfThisMonth = fromFactoryDateInputValue(startOfThisMonthStr);

        if (!start || !startOfThisMonth) return;

        const endOfPrevMonthStart = subtractFactoryDays(startOfThisMonth, 1);
        const end = getEndOfFactoryDay(endOfPrevMonthStart);

        updateDateRange({ from: start, to: end });
    };
    const isLastMonth = () => {
        const todayStart = getFactoryStartOfToday();
        const todayStr = toFactoryDateInputValue(todayStart);
        const [y, m] = todayStr.split('-');

        let prevM = parseInt(m) - 1;
        let prevY = parseInt(y);
        if (prevM < 1) { prevM = 12; prevY--; }

        const startOfPrevMonthStr = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
        const start = fromFactoryDateInputValue(startOfPrevMonthStr);

        const startOfThisMonthStr = `${y}-${m}-01`;
        const startOfThisMonth = fromFactoryDateInputValue(startOfThisMonthStr);

        if (!start || !startOfThisMonth) return false;

        const endOfPrevMonthStart = subtractFactoryDays(startOfThisMonth, 1);
        const end = getEndOfFactoryDay(endOfPrevMonthStart);

        return currentStart?.getTime() === start.getTime() && currentEnd?.getTime() === end.getTime();
    };


    return (
        <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-6 py-3">
            <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                {/* Left Side: Label + Quick Actions + Refresh */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400">
                        <Filter className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
                    </div>

                    {/* Quick Actions Pill Group */}
                    <div className="flex bg-slate-100 rounded-lg p-1 gap-1 flex-wrap sm:flex-nowrap">
                        <button
                            onClick={setToday}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all focus:outline-none ${isToday()
                                ? 'bg-white text-sky-600 shadow-sm ring-1 ring-sky-200'
                                : 'text-slate-600 hover:bg-white hover:shadow-sm'
                                }`}
                        >
                            Today
                        </button>
                        <button
                            onClick={setYesterday}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all focus:outline-none ${isYesterday()
                                ? 'bg-white text-sky-600 shadow-sm ring-1 ring-sky-200'
                                : 'text-slate-600 hover:bg-white hover:shadow-sm'
                                }`}
                        >
                            Yesterday
                        </button>
                        <button
                            onClick={setLast7Days}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all focus:outline-none ${isLast7Days()
                                ? 'bg-white text-sky-600 shadow-sm ring-1 ring-sky-200'
                                : 'text-slate-600 hover:bg-white hover:shadow-sm'
                                }`}
                        >
                            7 Days
                        </button>
                        <button
                            onClick={setLast30Days}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all focus:outline-none ${isLast30Days()
                                ? 'bg-white text-sky-600 shadow-sm ring-1 ring-sky-200'
                                : 'text-slate-600 hover:bg-white hover:shadow-sm'
                                }`}
                        >
                            30 Days
                        </button>
                        <button
                            onClick={setThisMonth}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all focus:outline-none ${isThisMonth()
                                ? 'bg-white text-sky-600 shadow-sm ring-1 ring-sky-200'
                                : 'text-slate-600 hover:bg-white hover:shadow-sm'
                                }`}
                        >
                            This Month
                        </button>
                        <button
                            onClick={setLastMonth}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all focus:outline-none ${isLastMonth()
                                ? 'bg-white text-sky-600 shadow-sm ring-1 ring-sky-200'
                                : 'text-slate-600 hover:bg-white hover:shadow-sm'
                                }`}
                        >
                            Last Month
                        </button>
                    </div>

                    <div className="h-6 w-[1px] bg-slate-200 mx-1 hidden sm:block"></div>

                    <button
                        onClick={handleRefresh}
                        className={`p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-full transition-all active:scale-90 ${isRefreshing ? 'animate-pulse text-sky-600 bg-sky-50' : ''}`}
                        title={`Last updated: ${formatDate(new Date(lastRefreshAt), 'pp')}`}
                    >
                        <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>

                {/* Right Side: Date Inputs + Shift */}
                <div className="flex items-center gap-4">

                    {/* Reusable Timezone Date Picker */}
                    <TimezoneDateRangePicker
                        timezone={factoryTimezone}
                        startDate={currentStart}
                        endDate={currentEnd}
                        onChange={({ start, end }) => handleUpdateDateRange(start, end)}
                    />

                    {/* Shift Selector */}
                    <select
                        className="px-3 py-1.5 text-sm border border-slate-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-700"
                        value={shift}
                        onChange={(e) => updateShift(e.target.value)}
                    >
                        <option value="ALL">All Shifts</option>
                        <option value="Shift A">Shift A (Morning)</option>
                        <option value="Shift B">Shift B (Evening)</option>
                        <option value="Shift C">Shift C (Night)</option>
                    </select>

                </div>
            </div>
        </div>
    );
};

export default DashboardFilterBar;
