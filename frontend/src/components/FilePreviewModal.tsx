import React, { useEffect, useState } from 'react';
import { X, Eye, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getFilePreview } from '@/lib/ingestionApi';
import type { FilePreview } from '@/types/ingestion';

interface FilePreviewModalProps {
    fileId: string | null;
    filename: string;
    isOpen: boolean;
    onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
    fileId,
    filename,
    isOpen,
    onClose,
}) => {
    const { t } = useTranslation();
    const [data, setData] = useState<FilePreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                t('file_preview.error_default')
            );
        } finally {
            setLoading(false);
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
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('file_preview.title')}</h3>
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
                            <p className="text-gray-600 dark:text-slate-300 font-medium">{t('file_preview.loading')}</p>
                            <p className="text-sm text-gray-500 dark:text-slate-500 mt-1">{t('file_preview.loading_subtitle')}</p>
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-900 dark:text-red-200">{t('file_preview.error_title')}</p>
                                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    {data && !loading && !error && (
                        <div className="space-y-4">
                            {/* Preview Badge */}
                            <div className="flex items-center justify-between">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-md">
                                    <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                                        {t('file_preview.showing_rows', { count: data.sample_rows.length })}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-500 dark:text-slate-400">
                                    {t('file_preview.columns_detected', { count: data.headers?.length || 0 })}
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
                                                                : <span className="text-gray-400 italic">{t('file_preview.null_value')}</span>}
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
                                    {t('file_preview.info_note')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium"
                    >
                        {t('common.actions.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

