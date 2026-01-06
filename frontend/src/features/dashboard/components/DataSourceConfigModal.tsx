import React, { useState, useEffect } from 'react';
import { X, Settings, Database, Clock, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getDataSourceByLine, updateDataSource, type DataSource } from '../../../lib/datasourceApi';

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
            setError('Failed to load configuration.');
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
            setError('Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animal-fade-in">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <Settings className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Data Source Configuration</h3>
                            <p className="text-xs text-gray-500">Production Line: {lineId}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {loading ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-3">
                            <Clock className="w-10 h-10 text-blue-500 animate-spin" />
                            <p className="text-sm font-medium text-gray-500">Loading configuration...</p>
                        </div>
                    ) : !dataSource ? (
                        <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="p-4 bg-yellow-50 rounded-full text-yellow-600">
                                <Database className="w-12 h-12" />
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-gray-900">No Data Source Configured</h4>
                                <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                                    No Data Source configured for this line. You need to upload data first to create one.
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                            >
                                Close Modal
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSave} className="space-y-5">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-red-700 text-sm animate-shake">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2 text-green-700 text-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Configuration updated successfully!
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
                                        Time Column
                                        <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={timeColumn}
                                        onChange={(e) => setTimeColumn(e.target.value)}
                                        placeholder="e.g. Timestamp, Date, Time"
                                        required
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                                    />
                                    <p className="mt-1.5 text-xs text-gray-500">
                                        The name of the column in your Excel/CSV files used for time-series analysis.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center justify-between">
                                        Active Schema Mapping
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                            Version {dataSource.schema_mappings.find(m => m.is_active)?.version || 1}
                                        </span>
                                    </label>
                                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50/30">
                                        <div className="max-h-60 overflow-y-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-100/80 border-b border-gray-200">
                                                        <th className="px-4 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-tight">Source Column</th>
                                                        <th className="px-4 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-tight">Target Field</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {(() => {
                                                        const rawMap = dataSource.schema_mappings.find(m => m.is_active)?.column_map || {};
                                                        const columnMap = typeof rawMap === 'string' ? JSON.parse(rawMap) : rawMap;
                                                        return Object.entries(columnMap).map(([src, target]) => (
                                                            <tr key={src} className="hover:bg-white transition-colors">
                                                                <td className="px-4 py-2.5 text-sm font-medium text-gray-700 font-mono text-[13px]">{src}</td>
                                                                <td className="px-4 py-2.5 text-sm">
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 font-medium text-[13px]">
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
                                    <p className="mt-2 text-xs text-gray-400 italic">
                                        Note: Schema mappings are learned automatically. To change mappings, upload a new version of the file.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                        Description
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Briefly describe this data source..."
                                        rows={2}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm resize-none"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 transition-all"
                                >
                                    {saving ? (
                                        <>
                                            <Clock className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Save Configuration
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
