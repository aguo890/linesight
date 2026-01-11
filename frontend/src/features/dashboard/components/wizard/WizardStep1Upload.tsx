import React, { useState, useRef } from 'react';
import { Loader2, AlertCircle, Database, Clock, FileText, ChevronRight } from 'lucide-react';
import type { DataSource } from '../../../../lib/ingestionApi';

interface WizardStep1UploadProps {
    onUseExisting: (dataSource: DataSource, dashboardName: string) => void;
    existingDataSources: DataSource[];
}

import { useDateFormatter } from '@/hooks/useDateFormatter';

export const WizardStep1Upload: React.FC<WizardStep1UploadProps> = ({
    onUseExisting,
    existingDataSources,
}) => {
    const { formatDate } = useDateFormatter();
    const [dashboardName, setDashboardName] = useState('');

    // REF: Add a ref to control focus and scrolling
    const dashboardInputRef = useRef<HTMLInputElement>(null);

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // HELPER: check if the current error is specifically about the name
    const isNameError = error === 'Please enter a Dashboard Name first.';

    const triggerNameError = () => {
        setError('Please enter a Dashboard Name first.');
        // LOGIC: Scroll to input and focus it
        if (dashboardInputRef.current) {
            dashboardInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            dashboardInputRef.current.focus();
        }
    };

    return (
        <div className="space-y-6">
            {/* Dashboard Name Input (Context) */}
            {/* VISUAL: Added conditional styling based on isNameError */}
            <div className={`p-4 rounded-lg border transition-colors duration-200 ${isNameError
                ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-800'
                : 'bg-brand/5 border-brand/20'
                }`}>
                <label htmlFor="dash-name" className={`block text-sm font-medium mb-1 ${isNameError ? 'text-red-700 dark:text-red-400' : 'text-text-main'
                    }`}>
                    Dashboard Name <span className="text-status-error">*</span>
                </label>
                <div className="relative">
                    <input
                        ref={dashboardInputRef}
                        id="dash-name"
                        type="text"
                        value={dashboardName}
                        onChange={(e) => {
                            setDashboardName(e.target.value);
                            if (isNameError) setError(null);
                        }}
                        placeholder="e.g. Line 4 Production Overview"
                        className={`block w-full rounded-md shadow-sm sm:text-sm p-2 border transition-all bg-surface text-text-main ${isNameError
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500 pr-10 dark:border-red-600'
                            : 'border-border focus:border-brand focus:ring-brand'
                            }`}
                    />
                    {isNameError && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <AlertCircle className="h-5 w-5 text-status-error" />
                        </div>
                    )}
                </div>
                {isNameError && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400 animate-pulse">
                        Please enter a name for your dashboard to continue.
                    </p>
                )}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-text-main">Data Source Selection</h3>
                    <p className="text-sm text-text-muted">
                        Select a previously uploaded file to configure your dashboard widgets.
                    </p>
                </div>
            </div>

            {/* MODE: EXISTING FILES LIST */}
            {existingDataSources.length > 0 ? (
                <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-sm">
                    <div className="overflow-y-auto max-h-[400px]">
                        <table className="min-w-full divide-y divide-border">
                            <thead className="bg-surface-subtle sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">File Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Uploaded</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-text-muted uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-surface divide-y divide-border">
                                {existingDataSources.map((source, index) => {
                                    const isComplete = source.ingestion_status === 'complete';
                                    return (
                                        <tr key={`${source.raw_import_id}-${index}`} className="hover:bg-brand/5 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <FileText className="w-4 h-4 text-text-muted mr-3" />
                                                    <span className="text-sm font-medium text-text-main">{source.filename}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {isComplete ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                        Ready
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                        Needs Setup
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                                                <div className="flex items-center">
                                                    <Clock className="w-3 h-3 mr-1.5" />
                                                    {formatDate(source.uploaded_at)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <button
                                                    onClick={async () => {
                                                        if (!dashboardName.trim()) {
                                                            triggerNameError();
                                                            return;
                                                        }
                                                        setIsProcessing(true);
                                                        try {
                                                            await onUseExisting(source, dashboardName);
                                                        } catch (err) {
                                                            console.error('Failed to configure existing source:', err);
                                                            setError('Failed to load existing data source configuration.');
                                                        } finally {
                                                            setIsProcessing(false);
                                                        }
                                                    }}
                                                    disabled={isProcessing}
                                                    className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isComplete
                                                        ? 'text-brand bg-brand/10 hover:bg-brand/20'
                                                        : 'text-amber-700 bg-amber-100 hover:bg-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:hover:bg-amber-900/50'
                                                        }`}
                                                >
                                                    {isProcessing ? (
                                                        <Loader2 className="w-3 h-3 animate-spin mr-1 text-brand" />
                                                    ) : (
                                                        <>
                                                            {isComplete ? 'Configure' : 'Complete Setup'}
                                                            <ChevronRight className="w-3 h-3 ml-1" />
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-3 bg-surface-subtle border-t border-border text-xs text-text-muted flex items-center justify-center">
                        <Database className="w-3 h-3 mr-1.5" />
                        Note: Your dashboard will include data from ALL files in this list. Select any file to define the widget columns.
                    </div>
                </div>
            ) : (
                <div className="p-8 text-center border-2 border-dashed border-border rounded-lg bg-surface-subtle">
                    <Database className="w-12 h-12 mx-auto text-text-muted/50 mb-4" />
                    <h4 className="text-lg font-medium text-text-main mb-2">No Data Sources Yet</h4>
                    <p className="text-sm text-text-muted">
                        Upload files from the Production Line page first, then return here to create a dashboard.
                    </p>
                </div>
            )}

            {/* Error display */}
            {error && !isNameError && (
                <div className="flex items-start space-x-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-red-900 dark:text-red-300">Error</p>
                        <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
                    </div>
                </div>
            )}
        </div >
    );
};
