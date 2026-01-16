import React from 'react';
import { AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';

import type { DryRunRecord } from '../../types/ingestion';

interface ImportPreviewTableProps {
    records: DryRunRecord[];
    onConfirm: () => void;
    onCancel: () => void;
    isSubmitting: boolean;
}

export const ImportPreviewTable: React.FC<ImportPreviewTableProps> = ({
    records,
    onConfirm,
    onCancel,
    isSubmitting
}) => {

    // Safety check: handle null/undefined/empty records after database reset
    if (!records || !Array.isArray(records) || records.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500">
                <p className="text-lg font-medium">No preview data available</p>
                <p className="text-sm mt-2">Please upload a file to see the preview.</p>
            </div>
        );
    }

    // Count specific issues for the summary header
    const warningCount = records.filter(r => r.status === 'warning').length;

    return (
        <div className="flex flex-col h-full space-y-4">
            {/* Summary Banner */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                    <h3 className="font-semibold text-slate-900">Review Data Import</h3>
                    <p className="text-sm text-slate-500">
                        {warningCount > 0
                            ? `⚠️ We found ${warningCount} rows that required AI assumptions (e.g., missing years).`
                            : "✓ All data looks clean and ready for import."}
                    </p>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
                    >
                        Edit Mapping
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 flex items-center"
                    >
                        {isSubmitting ? 'Importing...' : 'Confirm & Import'}
                    </button>
                </div>
            </div>

            {/* Comparison Table */}
            <div className="flex-1 overflow-auto border rounded-md shadow-sm">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 sticky top-0 z-10">
                        <tr>
                            <th className="p-3 font-medium text-slate-600 w-16">Row</th>
                            <th className="p-3 font-medium text-slate-600 w-1/3">Original Excel Data</th>
                            <th className="p-3 font-medium text-slate-600 w-8"></th>
                            <th className="p-3 font-medium text-slate-600 w-1/3">Cleaned Database Data</th>
                            <th className="p-3 font-medium text-slate-600">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {records.map((record, index) => (
                            <tr
                                key={record.row_index ?? `row-${index}`}
                                className={cn(
                                    "hover:bg-slate-50 transition-colors",
                                    record.status === 'warning' && "bg-yellow-50 hover:bg-yellow-100"
                                )}
                            >
                                <td className="p-3 text-slate-400 font-mono">{index + 1}</td>

                                {/* Raw Data Column */}
                                <td className="p-3 font-mono text-xs text-slate-500 truncate max-w-[200px]">
                                    {record.raw_data && Object.entries(record.raw_data).map(([k, v]) => (
                                        <div key={k}>
                                            <span className="font-semibold">{k}:</span> {String(v)}
                                        </div>
                                    ))}
                                </td>

                                {/* Arrow Icon */}
                                <td className="p-3 text-slate-300">
                                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                                </td>

                                {/* Cleaned Data Column - Highlights Dates */}
                                <td className="p-3">
                                    {record.cleaned_data && Object.entries(record.cleaned_data).map(([k, v]) => (
                                        <div key={k} className={cn(
                                            "text-xs mb-1",
                                            k === 'production_date' && record.status === 'warning' ? "font-bold text-yellow-700 bg-yellow-200/50 px-1 rounded w-fit" : ""
                                        )}>
                                            <span className="text-slate-500">{k}:</span> {String(v)}
                                        </div>
                                    ))}
                                </td>

                                {/* Status / Issues Column */}
                                <td className="p-3">
                                    {record.status === 'warning' ? (
                                        <div className="flex items-start text-yellow-600">
                                            <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                                            <div className="text-xs">
                                                {record.issues.map((issue, i) => (
                                                    <div key={i}>{issue}</div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center text-green-600">
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            <span className="text-xs">Valid</span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};