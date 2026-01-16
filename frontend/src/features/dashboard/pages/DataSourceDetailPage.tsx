import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
} from '../api/lineApi'; // TODO: Update this API file or move functions to factoryApi
import {
    useGetFactoryApiV1FactoriesFactoryIdGet
} from '../../../api/endpoints/factories/factories';

// Using new hooks/APIs where possible
import { useFactory } from '@/hooks/useFactory';
import { useFactoryFormat } from '@/hooks/useFactoryFormat';
import { FilePreviewModal } from '../../../components/FilePreviewModal';
import { MappingEditModal } from '../components/MappingEditModal';
import { updateSchemaMapping, getAvailableFields, type AvailableField } from '../../../lib/datasourceApi';

/**
 * Data Source Detail Page
 * Previously ProductionLinePage
 */
export const DataSourceDetailPage: React.FC = () => {
    const { t } = useTranslation();
    const { formatDate } = useFactoryFormat();
    const { factoryId, lineId } = useParams<{ factoryId: string, lineId: string }>();
    // Note: URL param is still 'lineId' for now to match router, but semantically it's dataSourceId
    const dataSourceId = lineId;

    const navigate = useNavigate();

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
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);

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

        if (dataSourceId && !uuidRegex.test(dataSourceId)) {
            navigate('/404', { replace: true });
            return;
        }

        if (dataSourceId) {
            loadDataSourceData(dataSourceId);
        }
    }, [factoryId, dataSourceId, navigate]);

    const loadDataSourceData = async (id: string) => {
        setDsLoading(true);
        try {
            const [dsData, uploadsData, fieldsData] = await Promise.all([
                getDataSource(id),
                getUploads(id),
                getAvailableFields()
            ]);
            setDataSource(dsData);
            setUploads(uploadsData.files);
            setAvailableFields(fieldsData);
        } catch (error: any) {
            // Handle 404 Not Found gracefully - data source may have been deleted
            const status = error?.response?.status || error?.status;
            if (status === 404) {
                console.warn('Data source not found (404). It may have been deleted.');
                setDataSource(null);
                setUploads([]);
            } else {
                console.error('Failed to load data source:', error);
            }
        } finally {
            setDsLoading(false);
        }
    };

    const handleResetSchema = async () => {
        if (!dataSource || !dataSourceId) return;

        if (confirm(t('data_source_detail.confirm.reset_schema'))) {
            setActionLoading(true);
            try {
                await deleteDataSource(dataSource.id);
                // Reload
                // Actually, if we delete the data source, we should probably navigate back or what?
                // The API deleteDataSource likely deletes the ENTITY? 
                // If so, we should navigate back to factory page.
                navigate(`/dashboard/factories/${factoryId}`);
            } catch (error) {
                console.error('Failed to reset schema:', error);
                alert(t('data_source_detail.errors.reset_failed'));
            } finally {
                setActionLoading(false);
            }
        }
    };

    const handleClearHistory = async () => {
        if (!dataSourceId) return;

        if (confirm(t('data_source_detail.confirm.clear_history'))) {
            setActionLoading(true);
            try {
                await deleteUploads(dataSourceId);
                await loadDataSourceData(dataSourceId);
            } catch (error) {
                console.error('Failed to clear history:', error);
                alert(t('data_source_detail.errors.clear_failed'));
            } finally {
                setActionLoading(false);
            }
        }
    };

    const handleSaveMapping = async (newMapping: Record<string, string>) => {
        if (!dataSource || !dataSourceId) return;

        try {
            await updateSchemaMapping(dataSourceId, {
                column_map: newMapping,
                reviewed_by_user: true
            });
            await loadDataSourceData(dataSourceId);
        } catch (error) {
            console.error("Failed to update mapping:", error);
            throw error; // Re-throw to let the modal handle the error state if needed
        }
    };

    if (dsLoading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
                </div>
            </MainLayout>
        );
    }

    if (!dataSource) {
        return (
            <MainLayout>
                <div className="text-center py-12">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t('data_source_detail.not_found')}</h2>
                    <Breadcrumb
                        items={[
                            { label: t('data_source_detail.breadcrumbs.workspace'), href: '/dashboard/factories' },
                            { label: factory?.name || t('data_source_detail.breadcrumbs.factory'), href: `/dashboard/factories/${factoryId}` },
                            { label: t('data_source_detail.breadcrumbs.not_found') }
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
                            { label: t('data_source_detail.breadcrumbs.workspace'), href: '/dashboard/factories' },
                            { label: factory?.name || t('data_source_detail.breadcrumbs.factory'), href: `/dashboard/factories/${factoryId}` },
                            { label: dataSource.source_name }
                        ]}
                        className="mb-4"
                    />
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl">
                            <Settings className="w-7 h-7 text-sky-600 dark:text-sky-500" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{dataSource.source_name}</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{t('data_source_detail.system_node')}: <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">{dataSource.id?.split('-')[0]}...</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Integration Panel */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/50 p-1 px-4">
                    <button
                        onClick={() => setActiveTab('schema')}
                        className={`px-6 py-3 text-sm font-bold transition-all flex items-center gap-2 border-b-2 ${activeTab === 'schema'
                            ? 'border-sky-600 text-sky-600 dark:text-sky-500'
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            } `}
                    >
                        <Database className="w-4 h-4" />
                        {t('data_source_detail.tabs.schema_configuration')}
                    </button>
                    <button
                        onClick={() => setActiveTab('uploads')}
                        className={`px-6 py-3 text-sm font-bold transition-all flex items-center gap-2 border-b-2 ${activeTab === 'uploads'
                            ? 'border-sky-600 text-sky-600 dark:text-sky-500'
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                            } `}
                    >
                        <Server className="w-4 h-4" />
                        {t('data_source_detail.tabs.upload_history')}
                        {uploads.length > 0 && (
                            <span className="ms-1 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-[10px]">
                                {uploads.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="p-6">
                    {activeTab === 'schema' && (
                        <div className="animate-in fade-in duration-300">
                            {dataSource ? (
                                <div className="space-y-6">
                                    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
                                        <div className="flex justify-between items-center mb-6">
                                            <div>
                                                <h4 className="font-bold text-slate-900 dark:text-white text-lg">{t('data_source_detail.schema.active_field_mapping')}</h4>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                                    {t('data_source_detail.schema.field_mapping_description')}
                                                </p>
                                            </div>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => setIsMappingModalOpen(true)}
                                                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                    {t('data_source_detail.schema.edit_mappings')}
                                                </button>
                                                <button
                                                    onClick={handleResetSchema}
                                                    disabled={actionLoading}
                                                    className="px-4 py-2 text-sm font-bold text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                                >
                                                    <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''} `} />
                                                    {t('data_source_detail.schema.reset_schema')}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full text-start">
                                                <thead className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-800">
                                                    <tr>
                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-1/2">{t('data_source_detail.schema.table.excel_header')}</th>
                                                        <th className="px-2 w-10"></th>
                                                        <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider w-1/2">{t('data_source_detail.schema.table.system_field')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                                    {columnMap && Object.entries(columnMap).map(([excel, system]) => (
                                                        <tr key={excel} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                                                            <td className="px-6 py-4 font-mono text-sm text-gray-700 dark:text-gray-300 font-medium">{excel}</td>
                                                            <td className="text-gray-300 dark:text-gray-600 text-center"><ArrowRight className="w-4 h-4 mx-auto" /></td>
                                                            <td className="px-6 py-4">
                                                                <span className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-bold text-sm border border-indigo-100 dark:border-indigo-800/50">
                                                                    {String(system)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {(!columnMap || Object.keys(columnMap).length === 0) && (
                                                        <tr>
                                                            <td colSpan={3} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 italic">
                                                                {t('data_source_detail.schema.no_mappings')}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                                            <div className={`w-2 h-2 rounded-full ${dataSource.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                                            <span>{t('data_source_detail.schema.system_status')}: {dataSource.is_active ? t('common.status.active') : t('common.status.inactive')}</span>
                                            <span className="mx-2">•</span>
                                            <span>{t('data_source_detail.schema.last_updated')}: {dataSource.updated_at ? new Date(dataSource.updated_at).toLocaleDateString() : 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-2xl">
                                    <Database className="w-12 h-12 text-gray-200 dark:text-slate-700 mx-auto mb-4" />
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('data_source_detail.schema.no_config_title')}</h3>
                                    <p className="text-gray-500 dark:text-gray-400 mb-2">{t('data_source_detail.schema.no_config_description')}</p>
                                    <p className="text-sm text-gray-400 dark:text-gray-600">
                                        {t('data_source_detail.schema.no_config_hint')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'uploads' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-gray-900 dark:text-white">{t('data_source_detail.uploads.processed_files')}</h3>
                                {uploads.length > 0 && (
                                    <button
                                        onClick={handleClearHistory}
                                        disabled={actionLoading}
                                        className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1.5"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        {t('data_source_detail.uploads.clear_history')}
                                    </button>
                                )}
                            </div>

                            {uploads.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {uploads.map((upload) => (
                                        <div
                                            key={upload.id}
                                            onClick={() => handleFileClick(upload)}
                                            className="p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/50 rounded-xl hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md transition-all flex items-center justify-between group cursor-pointer"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg group-hover:bg-sky-50 dark:group-hover:bg-sky-900/30 transition-colors">
                                                    <FileText className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-sky-600 dark:group-hover:text-sky-400" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 dark:text-white truncate max-w-[180px]" title={upload.original_filename}>
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
                                            <div className="text-end">
                                                <p className="text-xs font-bold text-gray-900 dark:text-gray-300">{formatDate(upload.created_at)}</p>
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{formatDate(upload.created_at, 'pp')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-gray-50/50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800">
                                    <Server className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">{t('data_source_detail.uploads.no_files')}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <MappingEditModal
                isOpen={isMappingModalOpen}
                onClose={() => setIsMappingModalOpen(false)}
                initialMapping={columnMap || {}}
                onSave={handleSaveMapping}
                availableFields={availableFields}
            />

            {/* File Preview Modal */}
            <FilePreviewModal
                fileId={previewFileId}
                filename={previewFilename}
                isOpen={isPreviewOpen}
                onClose={handleClosePreview}
            />
        </MainLayout>
    );
};

export default DataSourceDetailPage;
