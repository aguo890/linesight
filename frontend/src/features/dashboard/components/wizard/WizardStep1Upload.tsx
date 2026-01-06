import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Upload as UploadIcon, FileSpreadsheet, Loader2, AlertCircle, Eye, Database, Clock, FileText, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { uploadFileForIngestion, processFile as processFileAPI } from '../../../../lib/ingestionApi';
import type { ColumnMapping, DataSource } from '../../../../lib/ingestionApi';

interface WizardStep1UploadProps {
    onFileUploaded: (file: File, rawImportId: string, mappings: ColumnMapping[], dashboardName: string) => void;
    onUseExisting: (dataSource: DataSource, dashboardName: string) => void;
    factoryId?: string;
    productionLineId?: string;
    existingDataSources: DataSource[];
    onBeforeUpload?: () => Promise<{ factoryId: string; productionLineId: string }>;
}

import { useDateFormatter } from '@/hooks/useDateFormatter';

export const WizardStep1Upload: React.FC<WizardStep1UploadProps> = ({
    onFileUploaded,
    onUseExisting,
    factoryId,
    productionLineId,
    existingDataSources,
    onBeforeUpload
}) => {
    const { formatDate } = useDateFormatter();
    // Default to 'existing' if we have any files
    const [mode, setMode] = useState<'existing' | 'upload'>(
        existingDataSources.length > 0 ? 'existing' : 'upload'
    );
    const [dashboardName, setDashboardName] = useState('');

    // REF: Add a ref to control focus and scrolling
    const dashboardInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (existingDataSources.length > 0) {
            setMode('existing');
        } else {
            setMode('upload');
        }
    }, [existingDataSources]);

    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[][] | null>(null);
    const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);

    // HELPER: check if the current error is specifically about the name
    const isNameError = error === 'Please enter a Dashboard Name first.';

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const triggerNameError = () => {
        setError('Please enter a Dashboard Name first.');
        // LOGIC: Scroll to input and focus it
        if (dashboardInputRef.current) {
            dashboardInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            dashboardInputRef.current.focus();
        }
    };

    const processFile = async (file: File) => {
        if (!dashboardName.trim()) {
            triggerNameError();
            return;
        }

        setIsProcessing(true);
        setError(null);
        setSelectedFile(file);

        try {
            // Read and parse Excel file for preview
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

            // Extract headers and preview data
            const headers = jsonData[0] as string[];
            const previewRows = jsonData.slice(1, 6); // First 5 rows

            setPreviewHeaders(headers);
            setPreviewData(previewRows);

            // Determine Context IDs
            let finalFactoryId = factoryId;
            let finalProductionLineId = productionLineId;

            if (onBeforeUpload) {
                const context = await onBeforeUpload();
                finalFactoryId = context.factoryId;
                finalProductionLineId = context.productionLineId;
            }

            // Step 1: Upload file to backend
            const uploadResult = await uploadFileForIngestion(
                file,
                finalFactoryId,
                finalProductionLineId
            );

            const { raw_import_id } = uploadResult;

            // Step 2: Process through waterfall matching engine  
            const processResult = await processFileAPI(raw_import_id, {
                llmEnabled: true,
                factoryId: finalFactoryId,
            });

            // Step 3: Pass real mappings to wizard
            onFileUploaded(file, raw_import_id, processResult.columns, dashboardName);
        } catch (err: any) {
            console.error('File processing error:', err);
            setError(err.message || 'Failed to process file. Please ensure it\'s a valid Excel file.');
            setIsProcessing(false);
            setPreviewData(null);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (mode !== 'upload') return;

        const files = Array.from(e.dataTransfer.files);
        const excelFile = files.find(f =>
            f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv')
        );

        if (excelFile) {
            processFile(excelFile);
        } else {
            setError('Please upload an Excel (.xlsx, .xls) or CSV file');
        }
    }, [mode, dashboardName]); // Added dashboardName dependency

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFile(file);
        }
        e.target.value = '';
    };

    return (
        <div className="space-y-6">
            {/* Dashboard Name Input (Context) */}
            {/* VISUAL: Added conditional styling based on isNameError */}
            <div className={`p-4 rounded-lg border transition-colors duration-200 ${isNameError
                ? 'bg-red-50 border-red-300'
                : 'bg-blue-50/50 border-blue-100'
                }`}>
                <label htmlFor="dash-name" className={`block text-sm font-medium mb-1 ${isNameError ? 'text-red-700' : 'text-gray-700'
                    }`}>
                    Dashboard Name <span className="text-red-500">*</span>
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
                        className={`block w-full rounded-md shadow-sm sm:text-sm p-2 border transition-all ${isNameError
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500 pr-10'
                            : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                            }`}
                    />
                    {isNameError && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <AlertCircle className="h-5 w-5 text-red-500" />
                        </div>
                    )}
                </div>
                {isNameError && (
                    <p className="mt-1 text-sm text-red-600 animate-pulse">
                        Please enter a name for your dashboard to continue.
                    </p>
                )}
            </div>

            {/* Header / Tabs */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Data Source Selection</h3>
                    <p className="text-sm text-gray-500">
                        {mode === 'existing'
                            ? 'Select a file to configure your dashboard widgets.'
                            : 'Upload a new file to add to this production line.'}
                    </p>
                </div>
                {existingDataSources.length > 0 && (
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setMode('existing')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${mode === 'existing' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            History ({existingDataSources.length})
                        </button>
                        <button
                            onClick={() => setMode('upload')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${mode === 'upload' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Upload New
                        </button>
                    </div>
                )}
            </div>

            {/* MODE: EXISTING FILES LIST */}
            {mode === 'existing' && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <div className="overflow-y-auto max-h-[400px]">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {existingDataSources.map((source, index) => {
                                    const isComplete = source.ingestion_status === 'complete';
                                    return (
                                        <tr key={`${source.raw_import_id}-${index}`} className="hover:bg-blue-50 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <FileText className="w-4 h-4 text-gray-400 mr-3" />
                                                    <span className="text-sm font-medium text-gray-900">{source.filename}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {isComplete ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        Ready
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                        Needs Setup
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
                                                        ? 'text-blue-700 bg-blue-100 hover:bg-blue-200'
                                                        : 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200'
                                                        }`}
                                                >
                                                    {isProcessing ? (
                                                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
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
                    <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-center">
                        <Database className="w-3 h-3 mr-1.5" />
                        Note: Your dashboard will include data from ALL files in this list. Select any file to define the widget columns.
                    </div>
                </div>
            )
            }

            {/* Mode: Upload New */}
            {
                mode === 'upload' && (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${isDragging
                            ? 'border-blue-500 bg-blue-50'
                            : isProcessing
                                ? 'border-gray-300 bg-gray-50'
                                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
                            }`}
                    >
                        {isProcessing ? (
                            <div className="space-y-4">
                                <Loader2 className="w-12 h-12 mx-auto text-blue-600 animate-spin" />
                                <div>
                                    <p className="text-lg font-medium text-gray-900">Analyzing your data...</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        AI is identifying columns and suggesting mappings
                                    </p>
                                </div>
                                {selectedFile && (
                                    <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                                        <FileSpreadsheet className="w-4 h-4" />
                                        <span>{selectedFile.name}</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <UploadIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-lg font-medium text-gray-900 mb-2">
                                    Drop your Excel file here
                                </p>
                                <p className="text-sm text-gray-500 mb-4">
                                    or click to browse
                                </p>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
                                >
                                    Select File
                                </label>
                                <p className="text-xs text-gray-400 mt-4">
                                    Supports: .xlsx, .xls, .csv
                                </p>
                            </>
                        )}
                    </div>
                )
            }

            {/* 
               Only show the bottom generic error if it is NOT the name error. 
               The name error is now handled inline at the top.
            */}
            {
                error && !isNameError && (
                    <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-red-900">Upload Error</p>
                            <p className="text-sm text-red-700 mt-1">{error}</p>
                        </div>
                    </div>
                )
            }

            {/* Excel Preview (Only for upload mode) */}
            {
                mode === 'upload' && previewData && previewData.length > 0 && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden mt-6">
                        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Eye className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-900">Data Preview</span>
                            </div>
                            <span className="text-xs text-gray-500">
                                Showing first 5 rows of {selectedFile?.name}
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        {previewHeaders.map((header, idx) => (
                                            <th key={idx} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {previewData.map((row, rowIdx) => (
                                        <tr key={rowIdx} className="hover:bg-gray-50">
                                            {row.map((cell, cellIdx) => (
                                                <td key={cellIdx} className="px-3 py-2 text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-nowrap">
                                                    {cell !== null && cell !== undefined ? String(cell) : '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
