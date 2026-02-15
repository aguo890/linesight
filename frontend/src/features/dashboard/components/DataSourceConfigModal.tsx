import React, { useState, useEffect } from 'react';
import { X, Settings, Database, Clock, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDataSourceByLine, updateDataSource, type DataSource } from '@/lib/datasourceApi';

interface DataSourceConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    lineId: string;
}

export const DataSourceConfigModal: React.FC<DataSourceConfigModalProps> = ({
    isOpen,
    onClose,
    lineId
}) => {
    const { t } = useTranslation();
    const [dataSource, setDataSource] = useState<DataSource | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Form state
    const [timeColumn, setTimeColumn] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        if (isOpen && lineId) {
            fetchDataSource();
        }
    }, [isOpen, lineId]);

    const fetchDataSource = async () => {
        setLoading(true);
        setError(null);
        setSuccess(false);
        try {
            const data = await getDataSourceByLine(lineId);
            if (data) {
                setDataSource(data);
                setTimeColumn(data.time_column || '');
                setDescription(data.description || '');
            } else {
                setDataSource(null);
            }
        } catch (err) {
            console.error('Failed to fetch datasource config:', err);
            setError(t('data_source_config.error_load'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dataSource) return;

        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            await updateDataSource(dataSource.id, {
                time_column: timeColumn,
                description: description
            });
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
            }, 3000);
        } catch (err) {
            console.error('Failed to update datasource:', err);
            setError(t('data_source_config.error_save'));
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
            <div className="bg-surface dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-border dark:border-slate-800 animal-fade-in">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border dark:border-slate-800 flex items-center justify-between bg-surface-subtle/50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-brand/10 rounded-lg text-brand">
                            <Settings className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-text-main dark:text-white">{t('data_source_config.title')}</h3>
                            <p className="text-xs text-text-muted dark:text-slate-400">{t('data_source_config.subtitle', { id: lineId })}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-muted hover:text-text-main dark:text-slate-400 dark:hover:text-white hover:bg-surface-active dark:hover:bg-slate-700 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-3">
                            <Clock className="w-10 h-10 text-brand animate-spin" />
                            <p className="text-sm font-medium text-text-muted">{t('data_source_config.loading')}</p>
                        </div>
                    ) : !dataSource ? (
                        <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-full text-yellow-600 dark:text-yellow-400">
                                <Database className="w-12 h-12" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{t('data_source_config.not_configured_title')}</h4>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                                    {t('data_source_config.not_configured_desc')}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-900 dark:bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 dark:hover:bg-slate-600 transition-colors"
                            >
                                {t('data_source_config.close_modal')}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-5">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300 text-sm animate-shake">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300 text-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    {t('data_source_config.success')}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-text-main dark:text-white mb-1.5 flex items-center gap-1.5">
                                        {t('data_source_config.time_column')}
                                        <span className="text-error">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={timeColumn}
                                        onChange={(e) => setTimeColumn(e.target.value)}
                                        placeholder={t('data_source_config.time_column_placeholder')}
                                        required
                                        className="w-full px-4 py-2.5 bg-surface-subtle dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-text-main dark:text-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all text-sm"
                                    />
                                    <p className="mt-1.5 text-xs text-text-muted">
                                        {t('data_source_config.time_column_hint')}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-text-main dark:text-white mb-2 flex items-center justify-between">
                                        {t('data_source_config.schema_title')}
                                        <span className="text-[10px] bg-brand/10 text-brand px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                            {t('data_source_config.schema_version', { version: dataSource.schema_mappings.find(m => m.is_active)?.version || 1 })}
                                        </span>
                                    </label>
                                    <div className="border border-border dark:border-slate-700 rounded-lg overflow-hidden bg-surface-subtle/30 dark:bg-slate-800/30">
                                        <div className="max-h-60 overflow-y-auto">
                                            <table className="w-full text-start border-collapse">
                                                <thead>
                                                    <tr className="bg-surface-subtle dark:bg-slate-800 border-b border-border dark:border-slate-700">
                                                        <th className="px-4 py-2.5 text-xs font-bold text-text-muted dark:text-slate-400 uppercase tracking-tight">{t('data_source_config.table.source')}</th>
                                                        <th className="px-4 py-2.5 text-xs font-bold text-text-muted dark:text-slate-400 uppercase tracking-tight">{t('data_source_config.table.target')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border dark:divide-slate-800">
                                                    {(() => {
                                                        const rawMap = dataSource.schema_mappings.find(m => m.is_active)?.column_map || {};
                                                        const columnMap = typeof rawMap === 'string' ? JSON.parse(rawMap) : rawMap;
                                                        return Object.entries(columnMap).map(([src, target]) => (
                                                            <tr key={src} className="hover:bg-surface/50 dark:hover:bg-slate-700/50 transition-colors">
                                                                <td className="px-4 py-2.5 text-sm font-medium text-text-main dark:text-slate-200 font-mono text-[13px]">{src}</td>
                                                                <td className="px-4 py-2.5 text-sm">
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-brand/10 text-brand border border-brand/20 font-medium text-[13px]">
                                                                        {String(target)}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-xs text-text-muted italic">
                                        {t('data_source_config.schema_note')}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-text-main dark:text-white mb-1.5">
                                        {t('data_source_config.description')}
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder={t('data_source_config.description_placeholder')}
                                        rows={2}
                                        className="w-full px-4 py-2.5 bg-surface-subtle dark:bg-slate-800 border border-border dark:border-slate-700 rounded-lg text-text-main dark:text-white focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all text-sm resize-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-border dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 text-sm font-semibold text-text-muted hover:text-text-main dark:hover:text-white hover:bg-surface-active dark:hover:bg-slate-800 rounded-lg transition-colors"
                                >
                                    {t('common.actions.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white text-sm font-bold rounded-lg hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand/20 transition-all"
                                >
                                    {saving ? (
                                        <>
                                            <Clock className="w-4 h-4 animate-spin" />
                                            {t('common.processing')}
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            {t('data_source_config.save_button')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes animal-fade-in {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animal-fade-in {
                    animation: animal-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-4px); }
                    75% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
            ` }} />
        </div>
    );
};

export default DataSourceConfigModal;

