import React, { useState, useEffect } from 'react';
import { X, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { useCreateDataSourceApiV1FactoriesFactoryIdDataSourcesPost } from '../../../api/endpoints/factories/factories';
import type { QuotaStatus } from '../../../lib/quotaApi';

interface CreateDataSourceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    factoryId: string;
    factoryName: string;
    quotaStatus: QuotaStatus | null;
}

export const CreateDataSourceModal: React.FC<CreateDataSourceModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    factoryId,
    factoryName,
    quotaStatus
}) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [useDefaults, setUseDefaults] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const createDataSourceMutation = useCreateDataSourceApiV1FactoriesFactoryIdDataSourcesPost();

    // Get quota info for this specific factory
    // Note: Quota logic might need updates if it was specific to "Lines" but we assume it applies to DataSources now
    const factoryQuota = quotaStatus?.lines_per_factory.by_factory.find(f => f.factory_id === factoryId);
    const canCreate = factoryQuota?.can_create ?? true;

    useEffect(() => {
        if (!isOpen) {
            setName('');
            setCode('');
            setDescription('');
            setSpecialty('');
            setUseDefaults(true);
            setError(null);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError('Data Source name is required.');
            return;
        }

        if (!canCreate) {
            setError('Data Source quota limit reached for this factory.');
            return;
        }

        createDataSourceMutation.mutate(
            {
                factoryId,
                data: {
                    factory_id: factoryId, // Required by backend schema
                    source_name: name.trim(),
                    name: name.trim(),
                    code: code.trim() || undefined,
                    specialty: specialty.trim() || undefined,
                    description: description.trim() || undefined,
                    target_operators: 0, // Default to 0 if not specified
                    target_efficiency_pct: 0,
                    // Use 'settings' field for configuration
                    settings: {
                        is_custom_schedule: !useDefaults
                    }
                } as any
            },
            {
                onSuccess: () => {
                    onSuccess();
                    onClose();
                },
                onError: (err: any) => {
                    console.error('Failed to create data source:', err);
                    // Prevent React crash by ensuring error is a string
                    const errorMsg = err.response?.data?.detail
                        ? (typeof err.response.data.detail === 'string'
                            ? err.response.data.detail
                            : JSON.stringify(err.response.data.detail))
                        : 'Failed to create data source.';
                    setError(errorMsg);
                }
            }
        );
    };

    const isSubmitting = createDataSourceMutation.isPending;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Settings className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Add Data Source</h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Add a new source to {factoryName}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Quota Status */}
                {factoryQuota && (
                    <div className={`mx-6 mt-4 p-3 rounded-lg border ${canCreate
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-orange-50 border-orange-200'
                        }`}>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">Source Usage</span>
                            <span className={`text-sm font-bold ${canCreate ? 'text-blue-700' : 'text-orange-700'}`}>
                                {factoryQuota.current} / {quotaStatus?.lines_per_factory.max}
                            </span>
                        </div>
                        {!canCreate && (
                            <p className="text-xs text-orange-600 mt-1">
                                Maximum sources reached for this factory.
                            </p>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g. Line 3 / Cutting Table A"
                            disabled={!canCreate || isSubmitting}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 font-mono"
                                placeholder="L-03"
                                disabled={!canCreate || isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                            <input
                                type="text"
                                value={specialty}
                                onChange={(e) => setSpecialty(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. Assembly"
                                disabled={!canCreate || isSubmitting}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            placeholder="Briefly describe this data source..."
                            rows={2}
                            disabled={!canCreate || isSubmitting}
                        />
                    </div>

                    {/* Schedule Configuration */}
                    <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={useDefaults}
                                    onChange={(e) => setUseDefaults(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    disabled={!canCreate || isSubmitting}
                                />
                                <span className="text-sm font-medium text-gray-900">Use Factory Defaults</span>
                            </label>
                            <span className="text-xs text-gray-500">
                                {useDefaults ? 'Inherits shifts & weekends' : 'Custom configuration'}
                            </span>
                        </div>

                        {useDefaults ? (
                            <p className="text-xs text-gray-500 ml-6">
                                This source will automatically inherit the factory's standard shift pattern.
                            </p>
                        ) : (
                            <div className="ml-6 mt-2">
                                <p className="text-xs text-orange-600 flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Starting with empty schedule
                                </p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-md"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                            disabled={isSubmitting || !canCreate}
                        >
                            {isSubmitting ? 'Creating...' : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Add Source</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
