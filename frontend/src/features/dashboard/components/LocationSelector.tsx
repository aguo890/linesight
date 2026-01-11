import { useState, useEffect, useMemo, useRef } from 'react';
import * as ct from 'countries-and-timezones';
import { getTimezoneOffset } from 'date-fns-tz';
import { MapPin, Globe, Loader2, Check } from 'lucide-react';

interface LocationSelectorProps {
    countryCode?: string;
    timezone?: string;
    onChange: (value: { countryCode: string; timezone: string }) => void;
}

export default function LocationSelector({ countryCode, timezone, onChange }: LocationSelectorProps) {
    const [inputValue, setInputValue] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isAutoDetecting, setIsAutoDetecting] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Get all countries
    const allCountries = useMemo(() => {
        return (Object.values(ct.getAllCountries()) as ct.Country[]).sort((a: ct.Country, b: ct.Country) => a.name.localeCompare(b.name));
    }, []);

    // Filter countries based on search
    const filteredCountries = useMemo(() => {
        const query = inputValue.trim().toLowerCase();

        // If input matches the selected country exactly (or is empty), show all options
        // This prevents the "United States only" locked state
        if (!query) return allCountries;

        if (countryCode) {
            const selectedCountry = ct.getCountry(countryCode);
            if (selectedCountry && query === selectedCountry.name.toLowerCase()) {
                return allCountries;
            }
        }

        return allCountries.filter((c: ct.Country) => {
            const name = c.name.toLowerCase();
            const id = c.id.toLowerCase();

            // Basic matching
            if (name.includes(query) || id.includes(query)) return true;

            // Common aliases
            if (query === 'usa' && id === 'us') return true;
            if (query === 'uk' && (id === 'gb' || id === 'uk')) return true;
            if (query === 'uae' && id === 'ae') return true;

            return false;
        });
    }, [inputValue, allCountries, countryCode]);

    // Handle outside click to close dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync input value with selected country code
    useEffect(() => {
        if (countryCode) {
            const country = ct.getCountry(countryCode);
            if (country) {
                // Only update input if it's not currently being typed in (or exactly matches)
                if (!isDropdownOpen) {
                    setInputValue(country.name);
                }
            }
        } else {
            setInputValue('');
        }
    }, [countryCode, isDropdownOpen]);

    const handleCountrySelect = (c: ct.Country) => {
        setInputValue(c.name);
        setIsDropdownOpen(false);

        // Find best default timezone for this country
        const defaults = c.timezones;
        let defaultTz = defaults.length > 0 ? defaults[0] : 'UTC';

        // Try to keep existing timezone if it's valid for this country
        if (timezone && defaults.includes(timezone as any)) {
            defaultTz = timezone as any;
        }

        onChange({
            countryCode: c.id,
            timezone: defaultTz
        });
    };

    const handleAutoDetect = () => {
        setIsAutoDetecting(true);
        try {
            const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const detectedCountry = allCountries.find((c: ct.Country) => (c.timezones as any).includes(detectedTz));
            if (detectedCountry) {
                onChange({
                    countryCode: detectedCountry.id,
                    timezone: detectedTz
                });
                setInputValue(detectedCountry.name);
            } else {
                // Fallback: just set timezone, maybe keep country empty? 
                // Currently our props require both.
                // If we can't find country, maybe just set timezone and let user pick country?
                // For now, let's assume valid IANA timezones map to at least one country in our DB.
                onChange({
                    countryCode: countryCode || '', // Keep existing or empty
                    timezone: detectedTz
                });
            }
        } catch (e) {
            console.error("Failed to auto-detect", e);
        } finally {
            setTimeout(() => setIsAutoDetecting(false), 500); // Visual feedback delay
        }
    };

    // Get timezones for selected country
    const availableTimezones = useMemo(() => {
        if (!countryCode) return [];
        const country = ct.getCountry(countryCode);
        if (!country) return [];

        return country.timezones.map((tzName: string) => {
            // Calculate offset
            try {
                const now = new Date();
                const offsetMs = getTimezoneOffset(tzName as any, now);
                const offsetHours = offsetMs / 3600000;
                const sign = offsetHours >= 0 ? '+' : '';
                return {
                    id: tzName,
                    name: `${tzName.split('/').pop()?.replace(/_/g, ' ')} (GMT${sign}${offsetHours})`,
                    offset: offsetHours
                };
            } catch (e) {
                return { id: tzName, name: tzName, offset: 0 };
            }
        }).sort((a: { offset: number }, b: { offset: number }) => a.offset - b.offset);
    }, [countryCode]);

    return (
        <div className="space-y-4">

            {/* Auto-detect header */}
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-text-muted">Location & Timezone</label>
                <button
                    onClick={handleAutoDetect}
                    disabled={isAutoDetecting}
                    className="text-xs text-brand hover:text-brand-dark font-medium flex items-center gap-1 transition-colors"
                >
                    {isAutoDetecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                    Auto-Detect
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Country Combobox */}
                <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value);
                                setIsDropdownOpen(true);
                            }}
                            onFocus={(e) => {
                                e.target.select();
                                setIsDropdownOpen(true);
                            }}
                            placeholder="Search Country..."
                            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
                        />
                        <Globe className="w-4 h-4 text-text-muted absolute left-3 top-2.5" />
                    </div>

                    {isDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-surface rounded-lg shadow-lg border border-border max-h-60 overflow-y-auto">
                            {filteredCountries.length === 0 ? (
                                <div className="p-3 text-sm text-text-muted text-center">No countries found</div>
                            ) : (
                                filteredCountries.map((c: ct.Country) => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleCountrySelect(c)}
                                        className={`w-full text-left px-3 py-2 text-sm hover:bg-brand/10 flex items-center justify-between ${countryCode === c.id ? 'bg-brand/10 text-brand' : 'text-text-main'}`}
                                    >
                                        <span className="truncate">{c.name}</span>
                                        {countryCode === c.id && <Check className="w-3 h-3 text-brand" />}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Timezone Select */}
                <div className="relative">
                    <select
                        value={timezone}
                        onChange={(e) => onChange({ countryCode: countryCode || '', timezone: e.target.value })}
                        disabled={!countryCode}
                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none appearance-none disabled:bg-surface-subtle disabled:text-text-muted"
                    >
                        {!countryCode ? (
                            <option>Select Country First</option>
                        ) : (
                            availableTimezones.map((tz: { id: string; name: string }) => (
                                <option key={tz.id} value={tz.id}>{tz.name}</option>
                            ))
                        )}
                    </select>
                    <div className="absolute right-3 top-2.5 pointer-events-none text-text-muted">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>

            </div>

            {/* Info Helper */}
            {timezone && (
                <p className="text-xs text-text-muted flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Selected: <span className="font-medium text-text-main">{timezone}</span>
                </p>
            )}
        </div>
    );
}
