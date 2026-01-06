
import { useCallback } from 'react';
import { useFactoryContext } from '../contexts/FactoryContext';
import { formatInTimeZone } from 'date-fns-tz';

export const useFactoryFormat = () => {
    const { activeFactory } = useFactoryContext();

    const getDateFormat = useCallback(() => {
        return activeFactory?.settings?.date_format || 'MM/DD/YYYY';
    }, [activeFactory]);

    const getTimezone = useCallback(() => {
        return activeFactory?.settings?.timezone || 'UTC';
    }, [activeFactory]);

    const getCurrency = useCallback(() => {
        return activeFactory?.settings?.default_currency || 'USD';
    }, [activeFactory]);

    /**
     * Formats a date string, number, or Date object into the factory's timezone and preferred format.
     */
    const formatDate = useCallback((date: Date | string | number | null | undefined, formatStr?: string) => {
        if (!date) return '-';

        const tz = getTimezone();
        const fmt = formatStr || getDateFormat();

        // date-fns format string mapping if needed
        // The user's select options are: 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'
        // date-fns uses these standard tokens correctly except it is case sensitive. 
        // DD is day of year? No, dd is day of month. 
        // Let's normalize the user's stored format to date-fns tokens.
        // User stored: MM/DD/YYYY -> date-fns: MM/dd/yyyy
        // User stored: DD/MM/YYYY -> date-fns: dd/MM/yyyy
        // User stored: YYYY-MM-DD -> date-fns: yyyy-MM-dd

        let safeFormat = fmt
            .replace('DD', 'dd')
            .replace('YYYY', 'yyyy');

        try {
            return formatInTimeZone(new Date(date), tz, safeFormat);
        } catch (e) {
            console.error('Error formatting date', e);
            return String(date);
        }
    }, [getDateFormat, getTimezone]);

    /**
     * Formats a number as currency using the factory's default currency.
     */
    const formatCurrency = useCallback((amount: number | null | undefined) => {
        if (amount === null || amount === undefined) return '-';

        const currency = getCurrency();
        try {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency,
            }).format(amount);
        } catch (e) {
            console.error('Error formatting currency', e);
            return `${amount} ${currency}`;
        }
    }, [getCurrency]);

    return {
        formatDate,
        formatCurrency,
        dateFormat: getDateFormat(),
        timezone: getTimezone(),
        currency: getCurrency(),
        settings: activeFactory?.settings
    };
};
