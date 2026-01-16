import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Clock, AlertCircle, CheckCircle2, History, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listFilesByProductionLine, listFiles, getImportPreview, type FileListItem } from '../../../lib/fileApi';
import { DataPreviewModal } from './DataPreviewModal';

import { useDateFormatter } from '@/hooks/useDateFormatter';

interface UploadHistoryProps {
    productionLineId?: string;
}

export const UploadHistory: React.FC<UploadHistoryProps> = ({ productionLineId }) => {
    const { t } = useTranslation();
    const { formatDate } = useDateFormatter();
    const [uploads, setUploads] = useState<FileListItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFileForPreview, setSelectedFileForPreview] = useState<FileListItem | null>(null);
    const [previewData, setPreviewData] = useState<Record<string, any>[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        fetchUploads();
    }, [productionLineId]);

    useEffect(() => {
        if (selectedFileForPreview) {
            loadPreview(selectedFileForPreview.id);
        } else {
            setPreviewData([]);
        }
    }, [selectedFileForPreview]);

    const fetchUploads = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = productionLineId
                ? await listFilesByProductionLine(productionLineId, 10)
                : await listFiles(undefined, 10);
            setUploads(res.files);
        } catch (err) {
            console.error('Failed to fetch uploads', err);
            setError(t('upload_history.error'));
        } finally {
            setLoading(false);
        }
    };

    const loadPreview = async (fileId: string) => {
        setPreviewLoading(true);
        try {
            const data = await getImportPreview(fileId);
            setPreviewData(data.data || []);
        } catch (err) {
            console.error('Failed to fetch preview', err);
        } finally {
            setPreviewLoading(false);
        }
    };

    const renderStatusIcon = (status: string) => {
        switch (status.toLowerCase()) {
            case 'completed':
            case 'confirmed':
            case 'promoted': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
            case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'processing': return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />;
            default: return <History className="w-4 h-4 text-gray-400" />;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                {t('upload_history.loading')}
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center py-10 text-red-400">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-400" />
                    {t('upload_history.title')}
                </h3>
            </div>

            <div className="divide-y divide-slate-800">
                {uploads.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                        {t('upload_history.empty')}
                    </div>
                ) : (
                    uploads.map((upload) => (
                        <div
                            key={upload.id}
                            onClick={() => setSelectedFileForPreview(upload)}
                            className="grid grid-cols-4 py-3 px-4 border-b border-slate-800 text-sm items-center cursor-pointer hover:bg-slate-800/40 transition-colors group"
                        >
                            <div className="flex items-center gap-2 col-span-2">
                                <FileSpreadsheet className="h-4 w-4 text-slate-500 group-hover:text-sky-400" />
                                <span className="font-medium text-slate-200 group-hover:text-white truncate" title={upload.original_filename}>
                                    {upload.original_filename}
                                </span>
                            </div>

                            <div className="text-slate-400 text-xs text-center">
                                {formatDate(upload.created_at)}
                            </div>

                            <div className="flex justify-end items-center gap-2">
                                <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${upload.status === 'confirmed' || upload.status === 'promoted' ? 'bg-green-500/10 text-green-400' :
                                    upload.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                                        'bg-sky-500/10 text-sky-400'
                                    }`}>
                                    {upload.status}
                                </span>
                                {renderStatusIcon(upload.status)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selectedFileForPreview && (
                <DataPreviewModal
                    importId={selectedFileForPreview.id}
                    filename={selectedFileForPreview.original_filename}
                    onClose={() => setSelectedFileForPreview(null)}
                    data={previewData}
                />
            )}

            {previewLoading && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                    <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
                </div>
            )}
        </div>
    );
};

