
import React, { useState, useEffect } from 'react';
import {
    Database,
    FileSpreadsheet,
    ChevronDown,
    ChevronUp,
    Settings,
    AlertCircle,
    Clock
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { listDataSources, updateDataSource, type DataSource } from '../../../lib/datasourceApi';
import { X } from 'lucide-react'; // Import Close icon

interface DataIntegrationPanelProps {
    className?: string;
    productionLineId?: string; // Optional production line ID to filter uploads
}

import { DashboardWizard } from './DashboardWizard';
import { UploadHistory } from '../../factory-floor/components/UploadHistory';

export const DataIntegrationPanel: React.FC<DataIntegrationPanelProps> = ({ className = '', productionLineId }) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(true);
    const [activeTab, setActiveTab] = useState<'schema' | 'uploads'>('schema');
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    const [dataSources, setDataSources] = useState<DataSource[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);

    // Fetch data on mount and when production line changes
    useEffect(() => {
        if (isExpanded) {
            fetchData();
        }
    }, [isExpanded, activeTab, productionLineId]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            if (activeTab === 'uploads') {
                // UploadHistory component handles its own fetching
            } else {
                const res = await listDataSources();
                setDataSources(res);
            }
        } catch (err) {
            console.error('Failed to fetch data', err);
            setError(t('data_integration.error_update'));
        } finally {
            setLoading(false);
        }
    };

    const handleUploadComplete = () => {
        if (activeTab === 'uploads') fetchData();
        else setActiveTab('uploads');
    };

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDataSource) return;

        try {
            setLoading(true);
            await updateDataSource(editingDataSource.id, {
                time_column: editingDataSource.time_column,
                is_active: editingDataSource.is_active
            });
            setEditingDataSource(null);
            fetchData(); // Refresh list
        } catch (err) {
            console.error("Failed to update", err);
            setError(t('data_integration.error_update'));
        } finally {
            setLoading(false);
        }
    };

    // Layout and tabs helpers

    return (
        <div className={`bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden ${className}`}>
            {/* Header */}
            <div
                className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">{t('data_integration.title')}</h3>
                        <p className="text-xs text-gray-500">{t('data_integration.subtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2 text-gray-400">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsWizardOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-600 text-xs font-medium border border-blue-200 rounded-md hover:bg-blue-50 hover:border-blue-300 transition-colors me-2"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        {t('data_integration.upload_data')}
                    </button>
                    <span className="text-xs uppercase tracking-wider font-medium">
                        {isExpanded ? t('data_integration.collapse') : t('data_integration.expand')}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="border-t border-gray-200">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('schema')}
                            className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${activeTab === 'schema'
                                ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <Settings className="w-4 h-4" />
                                <span>{t('data_integration.tabs.schema')}</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('uploads')}
                            className={`flex-1 py-3 text-sm font-medium text-center transition-colors border-b-2 ${activeTab === 'uploads'
                                ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <FileSpreadsheet className="w-4 h-4" />
                                <span>{t('data_integration.tabs.uploads')}</span>
                            </div>
                        </button>
                    </div>

                    {/* Tab Panels */}
                    <div className="p-4 bg-white min-h-[200px]">
                        {loading ? (
                            <div className="flex justify-center items-center h-full py-8 text-gray-400">
                                <Clock className="w-6 h-6 animate-spin me-2" />
                                {t('common.processing')}
                            </div>
                        ) : error ? (
                            <div className="flex justify-center items-center h-full py-8 text-red-500">
                                <AlertCircle className="w-5 h-5 me-2" />
                                {error}
                            </div>
                        ) : (
                            <>
                                {activeTab === 'schema' && (
                                    <div className="space-y-4">
                                        {dataSources.length === 0 ? (
                                            <div className="text-center py-8 text-gray-500">
                                                <p>{t('data_integration.empty_sources')}</p>
                                                <button
                                                    onClick={() => setIsWizardOpen(true)}
                                                    className="mt-2 text-blue-600 hover:underline text-sm font-medium"
                                                >
                                                    {t('data_integration.configure_new')}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                {dataSources.map(ds => {
                                                    const activeMapping = ds.schema_mappings.find(m => m.is_active);
                                                    return (
                                                        <div key={ds.id} className="border rounded-md p-3 hover:border-blue-300 transition-colors">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <h4 className="font-medium text-gray-900">{ds.source_name}</h4>
                                                                <span className={`px-2 py-0.5 rounded text-xs ${ds.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                    {ds.is_active ? t('common.status.active') : t('common.status.inactive')}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-gray-500 mb-3 line-clamp-2">
                                                                {ds.description || t('data_integration.no_description')}
                                                            </div>

                                                            {activeMapping ? (
                                                                <div className="bg-gray-50 p-2 rounded text-xs font-mono text-gray-600 overflow-hidden">
                                                                    <div className="mb-1 font-semibold text-gray-700">{t('data_integration.schema_version', { version: activeMapping.version })}</div>
                                                                    <div className="truncate opacity-75">
                                                                        {typeof activeMapping.column_map === 'object' && activeMapping.column_map !== null
                                                                            ? JSON.stringify(activeMapping.column_map)
                                                                            : String(activeMapping.column_map ?? '')}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="bg-yellow-50 p-2 rounded text-xs text-yellow-700 flex items-center">
                                                                    <AlertCircle className="w-3 h-3 me-1" />
                                                                    {t('data_integration.no_active_schema')}
                                                                </div>
                                                            )}

                                                            <button
                                                                onClick={() => setEditingDataSource(ds)}
                                                                className="mt-3 w-full py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                                                            >
                                                                {t('data_integration.edit_config')}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'uploads' && (
                                    <UploadHistory productionLineId={productionLineId} />
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Configuration Modal */}
            {editingDataSource && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold">{t('data_integration.modal.title')}</h3>
                            <button onClick={() => setEditingDataSource(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveConfig} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('data_integration.modal.source_name')}</label>
                                <input
                                    type="text"
                                    value={editingDataSource.source_name || ''}
                                    disabled
                                    className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('data_integration.modal.time_column')}</label>
                                <input
                                    type="text"
                                    value={editingDataSource.time_column}
                                    onChange={(e) => setEditingDataSource({ ...editingDataSource, time_column: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('data_integration.modal.time_column_hint')}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={editingDataSource.is_active}
                                    onChange={(e) => setEditingDataSource({ ...editingDataSource, is_active: e.target.checked })}
                                    className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <label htmlFor="isActive" className="text-sm text-gray-700">{t('data_integration.modal.config_active')}</label>
                            </div>
                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setEditingDataSource(null)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    {t('common.actions.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {loading ? t('common.processing') : t('common.actions.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Upload Wizard */}
            <DashboardWizard
                isOpen={isWizardOpen}
                onClose={() => setIsWizardOpen(false)}
                onComplete={handleUploadComplete}
                mode="upload"
            />
        </div>
    );
};

