import React from 'react';
import { useTimezoneDate } from '../../hooks/useTimezoneDate';
import { useFactoryFormat } from '@/hooks/useFactoryFormat';
import { Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TimezoneDateRangePickerProps {
    /** The IANA timezone string to enforce (e.g. "Asia/Ho_Chi_Minh") */
    timezone: string;

    /** UTC Start Date */
    startDate: Date | null | undefined;

    /** UTC End Date */
    endDate: Date | null | undefined;

    /** 
     * Returns UTC Dates representing the exact Start/End of the selected days 
     * in the factory timezone.
     */
    onChange: (range: { start: Date; end: Date }) => void;

    className?: string;
}

export const TimezoneDateRangePicker: React.FC<TimezoneDateRangePickerProps> = ({
    timezone,
    startDate,
    endDate,
    onChange,
    className
}) => {
    const { t } = useTranslation();
    // Initialize hook with the PASSED timezone (decoupled from context)
    const {
        toFactoryDateInputValue,
        fromFactoryDateInputValue,
        getEndOfFactoryDay
    } = useTimezoneDate(timezone);

    const { formatDate } = useFactoryFormat();

    // Convert UTC Props -> String for Input
    // If startDate is undefined, we default to empty string
    const startStr = toFactoryDateInputValue(startDate);
    const endStr = toFactoryDateInputValue(endDate);

    const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value; // "YYYY-MM-DD"
        // 1. Get UTC Start of that Day
        const newStartUTC = fromFactoryDateInputValue(val);

        if (newStartUTC) {
            // Logic: If new Start is after current End, push End to match Start
            // Ensure we have a valid end date to compare against. 
            // If endDate is null, we can assume it matches start for a single day selection logic, 
            // or keep it null if we allowed open ranges (but type says Date).
            // Let's assume strict range for now.

            let finalEndUTC = endDate;

            // If current end is missing OR new start is after current end
            if (!finalEndUTC || newStartUTC > finalEndUTC) {
                // Set End to End of the SAME day
                finalEndUTC = getEndOfFactoryDay(newStartUTC);
            }

            onChange({ start: newStartUTC, end: finalEndUTC });
        }
    };

    const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        const newEndStartUTC = fromFactoryDateInputValue(val); // This is 00:00 of the end day

        if (newEndStartUTC) {
            // We want the End Date to be 23:59:59 of that day
            const newEndUTC = getEndOfFactoryDay(newEndStartUTC);

            // Logic: If new End is before Start, pull Start to match End (or block it)
            // Let's pull start
            let finalStartUTC = startDate;

            if (!finalStartUTC || finalStartUTC > newEndUTC) {
                finalStartUTC = newEndStartUTC; // Set start to 00:00 of that same day
            }

            onChange({ start: finalStartUTC, end: newEndUTC });
        }
    };

    return (
        <div className={`flex items-center gap-2 bg-surface-subtle border border-border rounded-lg px-3 py-1.5 ${className}`}>
            <Calendar className="w-4 h-4 text-text-muted" />

            <div className="relative group min-w-[90px] text-center">
                <div className="flex items-center justify-center gap-1.5 px-1">
                    <span className="text-sm text-text-main font-medium whitespace-nowrap">
                        {startDate ? formatDate(startDate) : <span className="text-text-muted">{t('components.date_range_picker.start_date')}</span>}
                    </span>
                    <Calendar className="w-3 h-3 text-text-muted" />
                </div>
                <input
                    type="date"
                    value={startStr}
                    onChange={handleStartChange}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    title={t('components.date_range_picker.start_in_timezone', { timezone })}
                />
            </div>

            <span className="text-border">→</span>

            <div className="relative group min-w-[90px] text-center">
                <div className="flex items-center justify-center gap-1.5 px-1">
                    <span className="text-sm text-text-main font-medium whitespace-nowrap">
                        {endDate ? formatDate(endDate) : <span className="text-text-muted">{t('components.date_range_picker.end_date')}</span>}
                    </span>
                    <Calendar className="w-3 h-3 text-text-muted" />
                </div>
                <input
                    type="date"
                    value={endStr}
                    onChange={handleEndChange}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    title={t('components.date_range_picker.end_in_timezone', { timezone })}
                />
            </div>
        </div>
    );
};
