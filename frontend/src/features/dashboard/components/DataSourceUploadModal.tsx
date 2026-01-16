/**
 * Data Source Upload Modal Component
 * 
 * Allows uploading Excel/CSV data to a specific data source.
 * Includes time range specification for the dataset.
 */
import React, { useState, useRef } from 'react';
import { X, Upload, Calendar, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { getDryRunPreview, uploadFileForIngestion } from '../../../lib/ingestionApi';
import type { DryRunResponse } from '../../../lib/ingestionApi';
import { ImportPreviewTable } from '../../../components/ui/ImportPreviewTable';


interface DataSourceUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (data: any) => void;
    dataSourceId: string;
    dataSourceName: string;
    factoryId: string;
}

export const DataSourceUploadModal: React.FC<DataSourceUploadModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    dataSourceId,
    dataSourceName,
    factoryId
}) => {
    const { t } = useTranslation();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewData, setPreviewData] = useState<DryRunResponse | null>(null);
    const [rawImportId, setRawImportId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    if (!isOpen) return null;

    const handleFileSelect = (selectedFile: File) => {
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));

        if (!validExtensions.includes(ext)) {
            setError(t('modals.upload.errors.invalid_extension'));
            return;
        }

        setFile(selectedFile);
        setError(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);

        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            // Using the updated helper that supports data_source_id
            const response = await uploadFileForIngestion(file, factoryId, dataSourceId);

            console.log('Upload successful:', response);

            // Change A: Handle duplicate files - if file already exists, show error and return early
            if (response.already_exists) {
                setError(t('modals.upload.errors.duplicate_file'));
                return;
            }

            const uploadedRawImportId = response.raw_import_id;
            setRawImportId(uploadedRawImportId);

            // NEW: Fetch dry-run preview
            try {
                const preview = await getDryRunPreview(uploadedRawImportId);
                setPreviewData(preview);
                setShowPreview(true);
            } catch (previewErr: unknown) {
                // Change B: Stop swallowing errors - extract and display the actual error message
                console.error('Failed to get preview:', previewErr);
                let previewErrorMessage = 'Failed to generate data preview.';
                if (isAxiosError(previewErr) && previewErr.response?.data?.detail) {
                    previewErrorMessage = typeof previewErr.response.data.detail === 'string'
                        ? previewErr.response.data.detail
                        : JSON.stringify(previewErr.response.data.detail);
                } else if (previewErr instanceof Error) {
                    previewErrorMessage = previewErr.message;
                }

                if (previewErrorMessage === 'Failed to generate data preview.') {
                    previewErrorMessage = t('modals.upload.errors.preview_failed');
                }

                // Special case: "No active schema mapping" means this is a NEW data source
                // In this case, skip preview and proceed to mapping wizard
                if (previewErrorMessage.includes('No active schema mapping')) {
                    console.log('New data source detected (no schema mapping yet), proceeding to mapping wizard.');
                    setSuccess(true);
                    setTimeout(() => {
                        onSuccess(response);
                        handleClose();
                    }, 1000);
                    return;
                }

                // For all other errors, display them to the user
                setError(previewErrorMessage);
                // Do NOT close the modal - let user see the error and try again
            }

        } catch (err) {
            let message = 'Upload failed';
            if (isAxiosError(err) && err.response?.data?.detail) {
                message = typeof err.response.data.detail === 'string'
                    ? err.response.data.detail
                    : JSON.stringify(err.response.data.detail);
            } else if (err instanceof Error) {
                message = err.message;
            }
            if (message === 'Upload failed') {
                message = t('modals.upload.errors.upload_failed');
            }
            setError(message);
        } finally {
            setUploading(false);
        }
    };

    const handlePreviewConfirm = () => {
        // User confirmed preview, proceed with mapping
        setSuccess(true);
        setTimeout(() => {
            onSuccess({ raw_import_id: rawImportId });
            handleClose();
        }, 1000);
    };

    const handlePreviewCancel = () => {
        // User canceled, go back to file selection
        setShowPreview(false);
        setPreviewData(null);
        setFile(null);
        setRawImportId(null);
    };

    const handleClose = () => {
        setFile(null);
        setError(null);
        setSuccess(false);
        setDragOver(false);
        setShowPreview(false);
        setPreviewData(null);
        setRawImportId(null);
        onClose();
    };


    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 transition-opacity"
                    onClick={handleClose}
                />

                {/* Modal */}
                <div className={`relative bg-surface rounded-2xl shadow-xl p-6 ${showPreview ? 'w-full max-w-6xl' : 'w-full max-w-lg'}`}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-text-main">
                                {showPreview ? t('modals.upload.title_preview') : t('modals.upload.title_upload')}
                            </h2>
                            <p className="text-sm text-text-muted mt-1">
                                {showPreview
                                    ? t('modals.upload.subtitle_preview')
                                    : t('modals.upload.subtitle_upload', { dataSourceName })}
                            </p>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 text-text-muted hover:text-text-main hover:bg-surface-subtle rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* CONDITIONAL: Show Preview Table OR Upload Form */}
                    {showPreview && previewData ? (
                        <div>
                            <ImportPreviewTable
                                records={previewData.preview_records ?? []}
                                onConfirm={handlePreviewConfirm}
                                onCancel={handlePreviewCancel}
                                isSubmitting={false}
                            />
                        </div>
                    ) : (
                        <>
                            {/* Drop Zone */}
                            <div
                                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`
                                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
                                    transition-all duration-200
                                    ${dragOver
                                        ? 'border-brand bg-brand/10'
                                        : file
                                            ? 'border-success/40 bg-success/10'
                                            : 'border-border hover:border-brand/40 hover:bg-surface-subtle'
                                    }
                                `}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                />

                                {file ? (
                                    <div className="flex flex-col items-center">
                                        <FileSpreadsheet className="w-12 h-12 text-success mb-3" />
                                        <p className="font-medium text-text-main">{file.name}</p>
                                        <p className="text-sm text-text-muted mt-1">
                                            {(file.size / 1024).toFixed(1)} KB
                                        </p>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                            className="mt-3 text-sm text-error hover:text-error/80"
                                        >
                                            {t('common.remove')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center">
                                        <Upload className="w-12 h-12 text-text-muted mb-3" />
                                        <p className="font-medium text-text-main">
                                            {t('modals.upload.drop_text')}
                                        </p>
                                        <p className="text-sm text-text-muted mt-1">
                                            {t('modals.upload.supports_text')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                                    <p className="text-sm text-error">{error}</p>
                                </div>
                            )}

                            {/* Success Message */}
                            {success && (
                                <div className="mt-4 p-3 bg-success/10 border border-success/20 rounded-lg flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                                    <p className="text-sm text-success">{t('modals.upload.success_redirect')}</p>
                                </div>
                            )}

                            {/* Info */}
                            <div className="mt-4 p-3 bg-info/10 border border-info/20 rounded-lg">
                                <p className="text-sm text-info">
                                    <Calendar className="w-4 h-4 inline-block me-1" />
                                    {t('modals.upload.info_preview')}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={handleClose}
                                    className="px-4 py-2 text-text-muted border border-border rounded-lg hover:bg-surface-subtle"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={!file || uploading || success}
                                    className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {uploading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            {t('modals.upload.btn_uploading' as any)}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" />
                                            {t('modals.upload.btn_upload_preview' as any)}
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
