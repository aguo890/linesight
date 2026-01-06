import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Settings, Database, Server, RefreshCw,
    FileText, Trash2, ArrowRight, X
} from 'lucide-react';
import { Breadcrumb } from '../../../components/ui/Breadcrumb';
import { MainLayout } from '../../../components/layout/MainLayout';
import {
    getDataSource,
    deleteDataSource,
    getUploads,
    deleteUploads,
    updateDataSource,
    type LineDataSource,
    type UploadRecord
} from '../api/lineApi';
import {
    useGetProductionLineApiV1FactoriesLinesLineIdGet,
    useGetFactoryApiV1FactoriesFactoryIdGet
} from '../../../api/endpoints/factories/factories';
import { DashboardWizard } from '../../dashboard/components/DashboardWizard';
import { FilePreviewModal } from '../../../components/FilePreviewModal';

import { useFactoryFormat } from '@/hooks/useFactoryFormat';

const ProductionLinePage: React.FC = () => {
    const { formatDate } = useFactoryFormat();
    const { factoryId, lineId } = useParams<{ factoryId: string, lineId: string }>();
    const navigate = useNavigate();

    // Orval React Query Hook for Production Line
    const { data: line, isLoading: lineLoading } = useGetProductionLineApiV1FactoriesLinesLineIdGet(
        lineId!,
        { query: { enabled: !!lineId } }
    );

    // Fetch factory for breadcrumb
    const { data: factory } = useGetFactoryApiV1FactoriesFactoryIdGet(
        factoryId!,
        { query: { enabled: !!factoryId } }
    );

    const [dataSource, setDataSource] = useState<LineDataSource | null>(null);
    const [uploads, setUploads] = useState<UploadRecord[]>([]);
    const [dsLoading, setDsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // UI State for the Integrated Panel
    const [activeTab, setActiveTab] = useState<'schema' | 'uploads'>('schema');
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isEditingConfig, setIsEditingConfig] = useState(false);
    const [editForm, setEditForm] = useState({ time_column: '', is_active: true });

    // Preview Modal State
    const [previewFileId, setPreviewFileId] = useState<string | null>(null);
    const [previewFilename, setPreviewFilename] = useState('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const handleFileClick = (upload: UploadRecord) => {
        setPreviewFileId(upload.id);
        setPreviewFilename(upload.original_filename);
        setIsPreviewOpen(true);
    };

    const handleClosePreview = () => {
        setIsPreviewOpen(false);
        setPreviewFileId(null);
        setPreviewFilename('');
    };

    // Move useMemo to top level to avoid conditional hook calls
    const columnMap = useMemo(() => {
        const schema = dataSource?.schema_mappings?.find(m => m.is_active);
        if (!schema?.column_map) return null;
        return typeof schema.column_map === 'string'
            ? JSON.parse(schema.column_map)
            : schema.column_map;
    }, [dataSource?.schema_mappings]);

    useEffect(() => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (factoryId && !uuidRegex.test(factoryId)) {
            navigate('/404', { replace: true });
            return;
        }

        if (lineId && !uuidRegex.test(lineId)) {
            navigate('/404', { replace: true });
            return;
        }

        if (lineId) {
            loadDataSourceData(lineId);
        }
    }, [factoryId, lineId, navigate]);

    const loadDataSourceData = async (id: string) => {
        setDsLoading(true);
        try {
            const [dsData, uploadsData] = await Promise.all([
                getDataSource(id),
                getUploads(id)
            ]);
            setDataSource(dsData);
            setUploads(uploadsData.files);
        } catch (error: any) {
            console.error('Failed to load data source:', error);
        } finally {
            setDsLoading(false);
        }
    };

    const loading = lineLoading || dsLoading;

    const handleResetSchema = async () => {
        if (!dataSource || !lineId) return;

        if (confirm('WARNING: This will delete the Data Source and all Schema Configurations for this line. This action cannot be undone. Are you sure?')) {
            setActionLoading(true);
            try {
                await deleteDataSource(dataSource.id);
                // Reload
                await loadDataSourceData(lineId);
            } catch (error) {
                console.error('Failed to reset schema:', error);
                alert('Failed to reset schema.');
            } finally {
                setActionLoading(false);
            }
        }
    };

    const handleClearHistory = async () => {
        if (!lineId) return;

        if (confirm('WARNING: This will delete ALL upload history and physical files for this line. This is a destructive action (nuclear reset). Are you sure?')) {
            setActionLoading(true);
            try {
                await deleteUploads(lineId);
                await loadDataSourceData(lineId);
            } catch (error) {
                console.error('Failed to clear history:', error);
                alert('Failed to clear output history.');
            } finally {
                setActionLoading(false);
            }
        }
    };

    const handleUpdateConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dataSource || !lineId) return;
        setActionLoading(true);
        try {
            await updateDataSource(dataSource.id, editForm);
            setIsEditingConfig(false);
            await loadDataSourceData(lineId);
        } catch (error) {
            console.error("Update failed", error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleUploadComplete = () => {
        if (lineId) loadDataSourceData(lineId);
        setActiveTab('uploads');
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
            </MainLayout>
        );
    }

    if (!line) {
        return (
            <MainLayout>
                <div className="text-center py-12">
                    <h2 className="text-xl font-bold text-gray-900">Production Line not found</h2>
                    <Breadcrumb
                        items={[
                            { label: 'Workspace', href: '/dashboard/factories' },
                            { label: factory?.name || 'Factory', href: `/dashboard/factories/${factoryId}` },
                            { label: 'Line Not Found' }
                        ]}
                        className="mt-4 justify-center"
                    />
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <Breadcrumb
                        items={[
                            { label: 'Workspace', href: '/dashboard/factories' },
                            { label: factory?.name || 'Factory', href: `/dashboard/factories/${factoryId}` },
                            { label: line.name }
                        ]}
                        className="mb-4"
                    />
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white border border-slate-200 shadow-sm rounded-xl">
                            <Settings className="w-7 h-7 text-sky-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{line.name}</h1>
                            <p className="text-slate-500 text-sm font-medium">System Node: <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{lineId?.split('-')[0]}...</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Integration Panel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50/30 p-1 px-4">
                    <button
                        onClick={() => setActiveTab('schema')}
                        className={`px-6 py-3 text-sm font-bold transition-all flex items-center gap-2 border-b-2 ${activeTab === 'schema'
                            ? 'border-sky-600 text-sky-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            } `}
                    >
                        <Database className="w-4 h-4" />
                        Schema Configuration
                    </button>
                    <button
                        onClick={() => setActiveTab('uploads')}
                        className={`px-6 py-3 text-sm font-bold transition-all flex items-center gap-2 border-b-2 ${activeTab === 'uploads'
                            ? 'border-sky-600 text-sky-600'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                            } `}
                    >
                        <Server className="w-4 h-4" />
                        Upload History
                        {uploads.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-[10px]">
                                {uploads.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'schema' && (
                        <div className="animate-in fade-in duration-300">
                            {dataSource ? (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                                            <div className="flex justify-between items-start mb-6">
                                                <h4 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Source Configuration</h4>
                                                <button
                                                    onClick={() => {
                                                        setEditForm({ time_column: dataSource.time_column, is_active: dataSource.is_active });
                                                        setIsEditingConfig(true);
                                                    }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Status</label>
                                                    <div className="mt-1">
                                                        <span className={`px - 2 py - 1 rounded text - xs font - bold ${dataSource.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} `}>
                                                            {dataSource.is_active ? 'ACTIVE' : 'INACTIVE'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase">Time Column</label>
                                                    <p className="font-mono text-sm font-bold text-blue-600">{dataSource.time_column}</p>
                                                </div>
                                                <div className="pt-4 border-t border-gray-200">
                                                    <button
                                                        onClick={handleResetSchema}
                                                        disabled={actionLoading}
                                                        className="w-full py-2 text-xs font-bold text-red-600 border border-red-100 rounded-lg hover:bg-red-50 flex items-center justify-center gap-2"
                                                    >
                                                        <RefreshCw className={`w - 3 h - 3 ${actionLoading ? 'animate-spin' : ''} `} />
                                                        Reset Entire Schema
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="lg:col-span-2">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="font-bold text-gray-900">Active Field Mapping</h4>
                                            <span className="text-xs font-medium text-gray-500">
                                                Last updated: {new Date(dataSource.updated_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50 border-b border-gray-100">
                                                    <tr>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">Excel Header</th>
                                                        <th className="px-2"></th>
                                                        <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase">System Field</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {columnMap && Object.entries(columnMap).map(([excel, system]) => (
                                                        <tr key={excel} className="hover:bg-blue-50/30 transition-colors">
                                                            <td className="px-4 py-3 font-mono text-sm text-gray-700">{excel}</td>
                                                            <td className="text-gray-300"><ArrowRight className="w-4 h-4" /></td>
                                                            <td className="px-4 py-3">
                                                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded font-medium text-sm">
                                                                    {String(system)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-2xl">
                                    <Database className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-gray-900">No Configuration Found</h3>
                                    <p className="text-gray-500 mb-6">This production line hasn't been mapped yet.</p>
                                    <button
                                        onClick={() => setIsWizardOpen(true)}
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                                    >
                                        Start Mapping Wizard
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'uploads' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-gray-900">Processed Files</h3>
                                {uploads.length > 0 && (
                                    <button
                                        onClick={handleClearHistory}
                                        disabled={actionLoading}
                                        className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Clear History
                                    </button>
                                )}
                            </div>

                            {uploads.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {uploads.map((upload) => (
                                        <div
                                            key={upload.id}
                                            onClick={() => handleFileClick(upload)}
                                            className="p-4 border border-slate-200 bg-white rounded-xl hover:border-sky-300 hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-slate-50 rounded-lg group-hover:bg-sky-50 transition-colors">
                                                    <FileText className="w-6 h-6 text-slate-400 group-hover:text-sky-600" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 truncate max-w-[180px]" title={upload.original_filename}>
                                                        {upload.original_filename}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${upload.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {upload.status}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-medium">
                                                            {(upload.file_size_bytes / 1024).toFixed(1)} KB
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-gray-900">{formatDate(upload.created_at)}</p>
                                                <p className="text-[10px] text-gray-400 font-medium">{formatDate(upload.created_at, 'pp')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                                    <Server className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-500 font-medium">No files have been uploaded for this line yet.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {isEditingConfig && dataSource && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-900">Edit Configuration</h3>
                            <button onClick={() => setIsEditingConfig(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateConfig} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Time Column Header</label>
                                <input
                                    type="text"
                                    value={editForm.time_column}
                                    onChange={(e) => setEditForm({ ...editForm, time_column: e.target.value })}
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                    placeholder="e.g., Production Date"
                                />
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-blue-50/50 rounded-xl">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={editForm.is_active}
                                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="isActive" className="text-sm font-bold text-blue-900">Data Source Active</label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditingConfig(false)}
                                    className="flex-1 px-4 py-3 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="flex-1 px-4 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 transition-all"
                                >
                                    {actionLoading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <DashboardWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onComplete={handleUploadComplete}
                mode="upload"
                preselectedLineId={lineId}
            />

            <FilePreviewModal
                fileId={previewFileId}
                filename={previewFilename}
                isOpen={isPreviewOpen}
                onClose={handleClosePreview}
            />
        </MainLayout>
    );
};

export default ProductionLinePage;
