import React, { useEffect, useState } from 'react';
import { X, Eye, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getFilePreview, processFile } from '../lib/ingestionApi';
import type { FilePreview } from '../types/ingestion';

interface FilePreviewModalProps {
    fileId: string | null;
    filename: string;
    isOpen: boolean;
    onClose: () => void;
    onProceedToAnalysis?: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
    fileId,
    filename,
    isOpen,
    onClose,
}) => {
    const navigate = useNavigate();
    const [data, setData] = useState<FilePreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Processing states
    const [processing, setProcessing] = useState(false);
    const [processingSuccess, setProcessingSuccess] = useState(false);
    const [processingError, setProcessingError] = useState<string | null>(null);
    const [processingMessage, setProcessingMessage] = useState('');

    useEffect(() => {
        if (fileId && isOpen) {
            loadPreview(fileId);
        }
    }, [fileId, isOpen]);

    const loadPreview = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const previewData = await getFilePreview(id);
            setData(previewData);
        } catch (err: any) {
            console.error('Preview failed:', err);
            setError(
                err.response?.data?.detail ||
                'Failed to load preview. Please ensure the file is a valid CSV or Excel document.'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleProceedToAnalysis = async () => {
        if (!fileId) return;

        setProcessing(true);
        setProcessingError(null);
        setProcessingMessage('Analyzing file structure...');

        try {
            // Call the processing API
            await processFile(fileId, {
                llmEnabled: false // Use rule-based parser by default
            });

            setProcessingMessage('Processing complete!');
            setProcessingSuccess(true);

            // Show success for 1.5 seconds, then close and redirect
            setTimeout(() => {
                onClose();
                // Navigate to analytics dashboard or wizard
                navigate('/dashboard');
            }, 1500);

        } catch (err: any) {
            console.error('Processing failed:', err);
            setProcessingError(
                err.response?.data?.detail ||
                'Processing failed. Please try again or contact support.'
            );
        } finally {
            setProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-slate-800">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Eye className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">File Preview</h3>
                            <p className="text-sm text-gray-600 dark:text-slate-400">{filename}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                            <p className="text-gray-600 dark:text-slate-300 font-medium">Loading preview...</p>
                            <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">Analyzing file structure</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-900 dark:text-red-200">Preview Error</p>
                                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {processing && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                            <p className="text-gray-900 dark:text-white font-medium text-lg">{processingMessage}</p>
                            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">This may take a moment...</p>
                        </div>
                    )}

                    {processingSuccess && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-10 h-10 text-green-600" />
                            </div>
                            <p className="text-gray-900 dark:text-white font-semibold text-lg">Processing Complete!</p>
                            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">Redirecting to dashboard...</p>
                        </div>
                    )}

                    {processingError && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mt-4">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-900 dark:text-red-200">Processing Error</p>
                                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{processingError}</p>
                            </div>
                        </div>
                    )}

                    {data && !loading && !error && !processing && !processingSuccess && (
                        <div className="space-y-4">
                            {/* Preview Badge */}
                            <div className="flex items-center justify-between">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-md">
                                    <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                        Showing first {data.sample_rows.length} rows
                                    </span>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-slate-400">
                                    {(data.headers?.length || 0)} columns detected
                                </div>
                            </div>

                            {/* Table */}
                            <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                                        <thead className="bg-gray-50 dark:bg-slate-800/50">
                                            <tr>
                                                {(data.headers || []).map((col, idx) => (
                                                    <th
                                                        key={idx}
                                                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap border-r border-gray-200 dark:border-slate-700 last:border-r-0"
                                                    >
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                                            {(data.sample_rows || []).map((row, rowIdx) => (
                                                <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                                    {(data.headers || []).map((_, colIdx) => (
                                                        <td
                                                            key={`${rowIdx}-${colIdx}`}
                                                            className="px-4 py-3 text-sm text-gray-900 dark:text-gray-300 whitespace-nowrap border-r border-gray-200 dark:border-slate-700 last:border-r-0"
                                                        >
                                                            {row[colIdx] !== null && row[colIdx] !== undefined
                                                                ? String(row[colIdx])
                                                                : <span className="text-gray-400 italic">null</span>}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Info Message */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-lg p-4">
                                <p className="text-sm text-blue-900 dark:text-blue-200">
                                    <strong>Note:</strong> This is a preview of your data. Review the columns and values
                                    to ensure the file uploaded correctly. When ready, proceed to analysis.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium"
                        disabled={processing}
                    >
                        Close
                    </button>
                    {data && !processingSuccess && (
                        <button
                            onClick={handleProceedToAnalysis}
                            disabled={processing}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    Proceed to Analysis
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
