import React, { useState, useEffect } from 'react';
import { X, Save, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AvailableField {
    field: string;
    description: string;
}

interface MappingEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMapping: Record<string, string>;
    onSave: (newMapping: Record<string, string>) => Promise<void>;
    availableFields: AvailableField[];
}

export const MappingEditModal: React.FC<MappingEditModalProps> = ({
    isOpen,
    onClose,
    initialMapping,
    onSave,
    availableFields
}) => {
    const [entries, setEntries] = useState<{ excel: string; system: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const mappedEntries = Object.entries(initialMapping || {}).map(([key, value]) => ({
                excel: key,
                system: String(value)
            }));
            setEntries(mappedEntries);
            setError(null);
            setSuccess(false);
        }
    }, [isOpen, initialMapping]);

    const handleSystemFieldChange = (index: number, newValue: string) => {
        const newEntries = [...entries];
        newEntries[index].system = newValue;
        setEntries(newEntries);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            const newMapping = entries.reduce((acc, curr) => {
                acc[curr.excel] = curr.system;
                return acc;
            }, {} as Record<string, string>);

            await onSave(newMapping);
            setSuccess(true);
            setTimeout(() => {
                onClose();
            }, 1000);
        } catch (err) {
            console.error('Failed to save mappings:', err);
            setError('Failed to save mappings. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 flex-shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Column Mappings</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Map your Excel headers to the correct System fields.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 overflow-y-auto min-h-0 space-y-4">

                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-sm animate-shake">
                                <AlertCircle className="w-4 h-4 ms-1" />
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
                                <CheckCircle2 className="w-4 h-4 ms-1" />
                                Mappings saved successfully!
                            </div>
                        )}

                        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                            <table className="w-full text-start">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-[45%]">Excel Header</th>
                                        <th className="px-2 w-[10%]"></th>
                                        <th className="px-5 py-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-[45%]">System Field</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {entries.map((entry, index) => (
                                        <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-5 py-3 font-mono text-xs font-bold text-slate-700 dark:text-slate-300 break-all">
                                                {entry.excel}
                                            </td>
                                            <td className="text-slate-300 dark:text-slate-600 text-center">
                                                <ArrowRight className="w-4 h-4 mx-auto" />
                                            </td>
                                            <td className="px-5 py-2">
                                                <select
                                                    value={entry.system}
                                                    onChange={(e) => handleSystemFieldChange(index, e.target.value)}
                                                    className="w-full px-3 py-1.5 text-sm font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-blue-700 dark:text-blue-300"
                                                >
                                                    <option value="" disabled>Select a field...</option>
                                                    {(availableFields || []).map((field) => (
                                                        <option key={field.field} value={field.field}>
                                                            {field.field} {field.description ? `- ${field.description}` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                    {entries.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center text-slate-400 dark:text-slate-500 text-sm italic">
                                                No mappings found. Upload a file to generate mappings.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-end gap-3 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || entries.length === 0}
                            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none transition-all flex items-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save Mappings
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
            ` }} />
        </div>
    );
};
