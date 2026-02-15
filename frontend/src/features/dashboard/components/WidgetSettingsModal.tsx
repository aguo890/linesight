/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect } from 'react';
import { X, Settings, Database, RotateCcw } from 'lucide-react';

import { z } from 'zod';
import { getWidgetSchema } from '../registry';

interface WidgetSettingsModalProps {
    isOpen: boolean;
    widgetType: string;
    widgetTitle?: string;
    currentSettings: Record<string, any>;
    onSave: (settings: Record<string, any>) => void;
    onClose: () => void;
}

/**
 * Zod-Driven Settings Modal
 * Dynamically renders form inputs based on the Zod schema defined in the registry.
 */
export const WidgetSettingsModal: React.FC<WidgetSettingsModalProps> = ({
    isOpen,
    widgetType,
    widgetTitle,
    currentSettings,
    onSave,
    onClose
}) => {
    const [formValues, setFormValues] = useState<Record<string, any>>({});
    const [errors, setErrors] = useState<z.ZodIssue[]>([]);
    const [schema, setSchema] = useState<z.ZodSchema<any> | null>(null);

    // 1. Retrieve the Source of Truth
    // When modal opens, fetch the schema and initialize form
    useEffect(() => {
        if (isOpen && widgetType) {
            const widgetSchema = getWidgetSchema(widgetType);
            setSchema(widgetSchema);

            // Merge current settings with defaults
            // We use safeParse to get default values if available in the schema
            const defaults = widgetSchema instanceof z.ZodObject
                ? widgetSchema.parse({})
                : {};

            setFormValues({ ...defaults, ...currentSettings });
            setErrors([]);
        }
    }, [isOpen, widgetType, currentSettings]);

    const handleChange = (name: string, value: any) => {
        setFormValues(prev => ({ ...prev, [name]: value }));
    };

    const handleReset = () => {
        // Reset to the state when the modal was opened
        setFormValues({ ...currentSettings });
        setErrors([]);
    };

    const handleSave = () => {
        if (!schema) return;

        const result = schema.safeParse(formValues);

        if (result.success) {
            onSave(result.data);
            onClose();
        } else {
            console.warn("Validation failed:", result.error);
            setErrors(result.error.issues);
        }
    };

    if (!isOpen) return null;

    // Helper to extract field metadata from Zod Schema
    // Zod doesn't have a simple public "shape" API on ZodSchema, so we check if it is ZodObject
    let fields: { key: string, def: z.ZodTypeAny, description?: string }[] = [];

    if (schema instanceof z.ZodObject) {
        // @ts-ignore - access internal shape for introspection
        const shape = schema.shape;
        fields = Object.entries(shape).map(([key, def]) => ({
            key,
            def: def as z.ZodTypeAny,
            description: (def as any).description
        }));
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="bg-surface rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 border border-border">

                {/* Header */}
                <div className="px-6 py-4 bg-surface-subtle border-b border-border flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand/10 rounded-lg">
                            <Settings className="w-4 h-4 text-brand" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-text-main">
                                {widgetTitle || 'Widget'} Settings
                            </h2>
                            <p className="text-xs text-text-muted">Configure display options</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-surface-active rounded-lg transition-colors">
                        <X className="w-5 h-5 text-text-muted" />
                    </button>
                </div>

                {/* Dynamic Form Generation Loop */}
                <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">
                    {fields.length === 0 ? (
                        <p className="text-text-muted text-sm text-center py-4">This widget has no configurable settings.</p>
                    ) : (
                        fields.map(({ key, def, description }) => (
                            <div key={key}>
                                <ZodFieldRenderer
                                    name={key}
                                    def={def}
                                    value={formValues[key]}
                                    description={description}
                                    onChange={(val) => handleChange(key, val)}
                                    error={errors.find(e => e.path.includes(key))}
                                />
                            </div>
                        ))
                    )}


                    {/* Dev Preview */}
                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-8 p-3 bg-surface-subtle rounded border border-border">
                            <p className="text-[10px] font-bold text-text-muted uppercase mb-1">Live Config Preview</p>
                            <pre className="text-[10px] text-text-muted overflow-x-auto font-mono">
                                {JSON.stringify(formValues, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-surface-subtle border-t border-border flex items-center justify-between flex-shrink-0">
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-muted hover:text-text-main hover:bg-surface-active rounded-lg transition-colors"
                        title="Reset to last saved state"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Changes
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-text-main bg-surface border border-border rounded-lg hover:bg-surface-subtle"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark shadow-sm shadow-brand/20"
                        >
                            Save Settings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Recursive Field Renderer ---

const ZodFieldRenderer: React.FC<{
    name: string;
    def: z.ZodTypeAny;
    value: any;
    description?: string;
    onChange: (val: any) => void;
    error?: z.ZodIssue;
}> = ({ name, def, value, description, onChange, error }) => {

    // Unwrap optional/default to get inner type
    let innerDef: any = def;
    while (innerDef instanceof z.ZodOptional || innerDef instanceof z.ZodDefault || innerDef instanceof z.ZodNullable) {
        if (innerDef instanceof z.ZodOptional) {
            innerDef = innerDef.unwrap();
        } else if (innerDef instanceof z.ZodDefault) {
            innerDef = innerDef.removeDefault();
        } else if (innerDef instanceof z.ZodNullable) {
            innerDef = innerDef.unwrap();
        }
    }

    const label = description || name.replace(/([A-Z])/g, ' $1').trim(); // Fallback to Title Case

    // 1. Boolean (Switch)
    if (innerDef instanceof z.ZodBoolean) {
        return (
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-text-main">{label}</label>
                    <button
                        type="button"
                        onClick={() => onChange(!value)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-brand' : 'bg-surface-active'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-surface shadow-sm transition-transform ${value ? 'ltr:translate-x-6 rtl:translate-x-1' : 'ltr:translate-x-1 rtl:translate-x-6'}`} />
                    </button>
                </div>
                {/* Special Logic: Mock Data Warning */}
                {name === 'useMockData' && value === true && (
                    <div className="flex items-center gap-2 p-2 bg-warning/10 text-warning text-xs rounded border border-warning/20 mt-2">
                        <Database className="w-3 h-3" />
                        <span className="font-medium">MOCK DATA MODE: Data will not be live.</span>
                    </div>
                )}
            </div>
        );
    }

    // 2. Number (Input)
    if (innerDef instanceof z.ZodNumber) {
        return (
            <div>
                <label className="block text-sm font-medium text-text-main mb-1">{label}</label>
                <input
                    type="number"
                    value={value ?? ''}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-lg text-sm bg-surface text-text-main focus:ring-2 focus:ring-brand outline-none transition-shadow ${error ? 'border-error ring-2 ring-error/20' : 'border-border'}`}
                />
            </div>
        );
    }

    // 3. Enum (Select)
    if (innerDef instanceof z.ZodEnum) {
        const options = innerDef.options;
        return (
            <div>
                <label className="block text-sm font-medium text-text-main mb-1">{label}</label>
                <select
                    value={String(value || '')}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-brand bg-surface text-text-main"
                >
                    {options.map((opt: string | number) => (
                        <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                    ))}
                </select>
            </div>
        );
    }

    // 4. String (Text Input)
    if (innerDef instanceof z.ZodString) {
        return (
            <div>
                <label className="block text-sm font-medium text-text-main mb-1">{label}</label>
                <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg text-sm bg-surface text-text-main focus:ring-2 focus:ring-brand outline-none ${error ? 'border-error ring-2 ring-error/20' : 'border-border'}`}
                />
            </div>
        );
    }

    // Default Fallback
    return (
        <div className="p-3 bg-surface-subtle rounded border border-border">
            <p className="text-xs text-text-muted">Unsupported field type: {name}</p>
        </div>
    );
};

export default WidgetSettingsModal;

