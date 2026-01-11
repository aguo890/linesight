import React, { useState, useEffect, Suspense } from 'react';
import { X, Save, Plus, Trash2, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateFactoryApiV1FactoriesFactoryIdPatch, getGetFactoryApiV1FactoriesFactoryIdGetQueryKey, getListFactoriesApiV1FactoriesGetQueryKey } from '../../../api/endpoints/factories/factories';
import type { Factory, FactorySettings, ShiftConfig } from '../../../lib/factoryApi';
import { formatInTimeZone } from 'date-fns-tz';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    factory: Factory;
}

const WEEKDAYS = [
    { value: 0, label: 'Mon' },
    { value: 1, label: 'Tue' },
    { value: 2, label: 'Wed' },
    { value: 3, label: 'Thu' },
    { value: 4, label: 'Fri' },
    { value: 5, label: 'Sat' },
    { value: 6, label: 'Sun' },
];

const CURRENCIES = [
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'GBP', label: 'GBP - British Pound' },
    { value: 'CNY', label: 'CNY - Chinese Yuan' },
    { value: 'INR', label: 'INR - Indian Rupee' },
    { value: 'VND', label: 'VND - Vietnamese Dong' },
    { value: 'BDT', label: 'BDT - Bangladeshi Taka' },
];

const LocationSelector = React.lazy(() => import('./LocationSelector'));

const DATE_FORMATS = [
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (US)' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (UK/EU)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
];

const MEASUREMENT_SYSTEMS = [
    { value: 'metric', label: 'Metric (kg, cm)' },
    { value: 'imperial', label: 'Imperial (lbs, in)' },
];

export const FactorySettingsModal: React.FC<Props> = ({ isOpen, onClose, factory }) => {
    // State
    const [shifts, setShifts] = useState<ShiftConfig[]>([]);
    const [currency, setCurrency] = useState('USD');
    const [weekends, setWeekends] = useState<number[]>([]);

    // Localization State
    const [country, setCountry] = useState('');
    const [timezone, setTimezone] = useState('UTC');
    const [originalTimezone, setOriginalTimezone] = useState('UTC');
    const [showTimezoneWarning, setShowTimezoneWarning] = useState(false);

    const [dateFormat, setDateFormat] = useState('MM/DD/YYYY');
    const [measurementSystem, setMeasurementSystem] = useState('metric');

    const [isSubmitting, setIsSubmitting] = useState(false);

    const queryClient = useQueryClient();

    // Mutation
    const updateFactoryMutation = useUpdateFactoryApiV1FactoriesFactoryIdPatch();

    // Initialize state from factory props
    useEffect(() => {
        if (isOpen && factory) {
            const settings = factory.settings;

            // Handle new field names with fallback to old ones if data exists
            setShifts((settings?.default_shift_pattern) || (settings?.operating_shifts) || []);
            setWeekends((settings?.standard_non_working_days) || (settings?.weekend_days) || [5, 6]);

            // New fields
            setCurrency(settings?.default_currency || 'USD'); // kept as is

            // Factory Level Fields (fallback to settings if not at root)
            setCountry(factory.country || settings?.country || '');
            const tz = factory.timezone || settings?.timezone || 'UTC';
            setTimezone(tz);
            setOriginalTimezone(tz);
            setDateFormat(settings?.date_format || 'MM/DD/YYYY');
            setMeasurementSystem(settings?.measurement_system || 'metric');
        }
    }, [isOpen, factory]);

    const handleSaveRequest = () => {
        // Check if timezone changed from non-UTC to something else, or significant change
        // For safety, if timezone changed and it wasn't just setting explicit UTC from default, warn user.
        if (timezone !== originalTimezone && factory.is_active) {
            setShowTimezoneWarning(true);
        } else {
            executeSave();
        }
    };

    const executeSave = () => {
        setIsSubmitting(true);
        const updatePayload: any = {
            country: country, // Top level
            timezone: timezone, // Top level
            settings: {
                default_shift_pattern: shifts,
                standard_non_working_days: weekends,

                // Localization
                default_currency: currency,
                // We keep strict IANA string in settings too for backward compat if needed, 
                // but top level is source of truth.
                timezone: timezone,
                date_format: dateFormat,
                measurement_system: measurementSystem,
            }
        };

        // Optimistically update the cache
        const queryKey = getGetFactoryApiV1FactoriesFactoryIdGetQueryKey(factory.id);
        const previousFactory = queryClient.getQueryData(queryKey);

        queryClient.setQueryData(queryKey, (old: any) => {
            if (!old) return old;
            return {
                ...old,
                country: country,
                timezone: timezone,
                settings: {
                    ...old.settings,
                    ...updatePayload.settings
                }
            };
        });

        updateFactoryMutation.mutate(
            {
                factoryId: factory.id,
                data: updatePayload
            },
            {
                onSuccess: () => {
                    setIsSubmitting(false);
                    setShowTimezoneWarning(false);
                    onClose();
                    // Invalidate to ensure consistency
                    queryClient.invalidateQueries({ queryKey });
                    // Also invalidate the list so the Context updates
                    queryClient.invalidateQueries({ queryKey: getListFactoriesApiV1FactoriesGetQueryKey() });
                },
                onError: (error) => {
                    console.error('Failed to update factory settings:', error);
                    setIsSubmitting(false);
                    // Revert optimistic update
                    if (previousFactory) {
                        queryClient.setQueryData(queryKey, previousFactory);
                    }
                    alert('Failed to save settings. Please try again.');
                }
            }
        );
    };

    const addShift = () => {
        setShifts([...shifts, { name: 'New Shift', start_time: '09:00', end_time: '17:00' }]);
    };

    const updateShift = (index: number, field: keyof ShiftConfig, value: string) => {
        const newShifts = [...shifts];
        newShifts[index] = { ...newShifts[index], [field]: value };
        setShifts(newShifts);
    };

    const removeShift = (index: number) => {
        setShifts(shifts.filter((_, i) => i !== index));
    };

    const toggleWeekendDay = (dayValue: number) => {
        if (weekends.includes(dayValue)) {
            setWeekends(weekends.filter(d => d !== dayValue));
        } else {
            setWeekends([...weekends, dayValue].sort());
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            {/* Warning Modal Overlay */}
            {showTimezoneWarning && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px] p-4">
                    <div className="bg-surface rounded-lg shadow-xl p-6 max-w-sm w-full border border-warning/20">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-warning/10 rounded-full text-warning">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-text-main">Change Timezone?</h4>
                                <p className="text-sm text-text-muted mt-2">
                                    Changing the timezone to <strong>{timezone}</strong> may affect historical data reporting and active shift schedules.
                                </p>
                                <div className="mt-6 flex gap-3 justify-end">
                                    <button
                                        onClick={() => setShowTimezoneWarning(false)}
                                        className="px-3 py-2 text-text-muted hover:bg-surface-subtle rounded-md text-sm font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={executeSave}
                                        className="px-3 py-2 bg-warning text-white hover:bg-warning/90 rounded-md text-sm font-medium"
                                    >
                                        Yes, Update Timezone
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-surface rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-surface z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand/10 rounded-lg text-brand">
                            <Save className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text-main">Factory Standards & Defaults</h2>
                            <p className="text-sm text-text-muted">Configure global defaults for {factory.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main hover:bg-surface-subtle rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-8 flex-1 overflow-y-auto">

                    {/* Localization Section */}
                    <section>
                        <h3 className="text-sm font-semibold text-text-main flex items-center gap-2 mb-4">
                            <Clock className="w-4 h-4 text-text-muted" />
                            Localization & Formats
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="col-span-1 md:col-span-2">
                                <Suspense fallback={<div className="h-20 bg-surface-subtle animate-pulse rounded-lg" />}>
                                    <LocationSelector
                                        countryCode={country}
                                        timezone={timezone}
                                        onChange={(val) => {
                                            setCountry(val.countryCode);
                                            setTimezone(val.timezone);
                                        }}
                                    />
                                </Suspense>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-text-muted mb-1 block">Date Format</label>
                                <select
                                    value={dateFormat}
                                    onChange={(e) => setDateFormat(e.target.value)}
                                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                >
                                    {DATE_FORMATS.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-text-muted mt-1">
                                    Preview: <span className="font-medium text-text-main">
                                        {(() => {
                                            try {
                                                const safeFormat = dateFormat.replace('DD', 'dd').replace('YYYY', 'yyyy');
                                                return formatInTimeZone(new Date(), timezone || 'UTC', safeFormat);
                                            } catch (e) { return '-'; }
                                        })()}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-text-muted mb-1 block">Currency</label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                >
                                    {CURRENCIES.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-text-muted mt-1">
                                    Preview: <span className="font-medium text-text-main">
                                        {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(1234.56)}
                                    </span>
                                </p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-text-muted mb-1 block">Measurement System</label>
                                <select
                                    value={measurementSystem}
                                    onChange={(e) => setMeasurementSystem(e.target.value)}
                                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                >
                                    {MEASUREMENT_SYSTEMS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Operating Shifts Section */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-text-main flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-text-muted" />
                                    Default Shift Pattern
                                </h3>
                                <p className="text-xs text-text-muted mt-1">
                                    New production lines will inherit these shifts.
                                </p>
                            </div>
                            <button onClick={addShift} className="text-sm text-brand font-medium hover:text-brand-dark flex items-center gap-1">
                                <Plus className="w-4 h-4" />
                                Add Shift
                            </button>
                        </div>
                        <div className="space-y-3">
                            {shifts.length === 0 && (
                                <div className="p-4 bg-surface-subtle rounded-lg border border-dashed border-border text-center text-sm text-text-muted">
                                    No shifts configured. Add a shift to set the default daily schedule.
                                </div>
                            )}
                            {shifts.map((shift, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row gap-3 p-3 bg-surface-subtle rounded-lg border border-border">
                                    <div className="flex-1">
                                        <label className="text-xs font-medium text-text-muted mb-1 block">Shift Name</label>
                                        <input
                                            type="text"
                                            value={shift.name}
                                            onChange={(e) => updateShift(idx, 'name', e.target.value)}
                                            className="w-full px-3 py-1.5 bg-surface border border-border rounded text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                            placeholder="e.g. Morning"
                                        />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-xs font-medium text-text-muted mb-1 block">Start Time</label>
                                        <input
                                            type="time"
                                            value={shift.start_time}
                                            onChange={(e) => updateShift(idx, 'start_time', e.target.value)}
                                            className="w-full px-3 py-1.5 bg-surface border border-border rounded text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                        />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-xs font-medium text-text-muted mb-1 block">End Time</label>
                                        <input
                                            type="time"
                                            value={shift.end_time}
                                            onChange={(e) => updateShift(idx, 'end_time', e.target.value)}
                                            className="w-full px-3 py-1.5 bg-surface border border-border rounded text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                        />
                                    </div>
                                    <div className="flex items-end pb-0.5">
                                        <button onClick={() => removeShift(idx)} className="p-2 text-error/60 hover:text-error hover:bg-error/10 rounded transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <hr className="border-border" />

                    {/* Weekend Settings */}
                    <section>
                        <div>
                            <h3 className="text-sm font-semibold text-text-main flex items-center gap-2 mb-4">
                                <Calendar className="w-4 h-4 text-text-muted" />
                                Standard Non-Working Days
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {WEEKDAYS.map(day => {
                                    const isSelected = weekends.includes(day.value);
                                    return (
                                        <button
                                            key={day.value}
                                            onClick={() => toggleWeekendDay(day.value)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isSelected
                                                ? 'bg-brand text-white shadow-sm ring-2 ring-brand ring-offset-1'
                                                : 'bg-surface-subtle text-text-muted hover:bg-border'
                                                }`}
                                        >
                                            {day.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-text-muted mt-2">
                                These days will be marked as non-working by default. Individual lines can override this.
                            </p>
                        </div>
                    </section>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border bg-surface-subtle/50 rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-text-muted font-medium hover:bg-surface-subtle rounded-lg transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveRequest}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-brand text-white font-medium rounded-lg hover:bg-brand-dark transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
