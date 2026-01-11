import React, { useState, useEffect } from 'react';
import { X, Settings, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-lg shadow-2xl max-w-md w-full border border-border">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand/10 rounded-lg">
                            <Settings className="w-6 h-6 text-brand" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text-main">Add Data Source</h2>
                            <p className="text-sm text-text-muted mt-0.5">
                                Add a new source to {factoryName}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full text-text-muted hover:text-text-main">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Quota Status */}
                {factoryQuota && (
                    <div className={`mx-6 mt-4 p-3 rounded-lg border ${canCreate
                        ? 'bg-brand/10 border-brand/20'
                        : 'bg-danger/10 border-danger/20'
                        }`}>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-text-main">Source Usage</span>
                            <span className={`text-sm font-bold ${canCreate ? 'text-brand' : 'text-danger'}`}>
                                {factoryQuota.current} / {quotaStatus?.lines_per_factory.max}
                            </span>
                        </div>
                        {!canCreate && (
                            <p className="text-xs text-danger mt-1">
                                Maximum sources reached for this factory.
                            </p>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-main placeholder:text-text-muted/50 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all"
                            placeholder="e.g. Line 3 / Cutting Table A"
                            disabled={!canCreate || isSubmitting}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-main mb-1">Code</label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-main placeholder:text-text-muted/50 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all font-mono"
                                placeholder="L-03"
                                disabled={!canCreate || isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-main mb-1">Specialty</label>
                            <input
                                type="text"
                                value={specialty}
                                onChange={(e) => setSpecialty(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-main placeholder:text-text-muted/50 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all"
                                placeholder="e.g. Assembly"
                                disabled={!canCreate || isSubmitting}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-main placeholder:text-text-muted/50 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all resize-none"
                            placeholder="Briefly describe this data source..."
                            rows={2}
                            disabled={!canCreate || isSubmitting}
                        />
                    </div>

                    {/* Schedule Configuration */}
                    <div className="bg-surface-subtle p-4 rounded-lg border border-border/50">
                        <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={useDefaults}
                                    onChange={(e) => setUseDefaults(e.target.checked)}
                                    className="w-4 h-4 text-brand rounded border-border focus:ring-brand bg-surface"
                                    disabled={!canCreate || isSubmitting}
                                />
                                <span className="text-sm font-medium text-text-main">Use Factory Defaults</span>
                            </label>
                            <span className="text-xs text-text-muted">
                                {useDefaults ? 'Inherits shifts & weekends' : 'Custom configuration'}
                            </span>
                        </div>

                        {useDefaults ? (
                            <p className="text-xs text-text-muted ml-6">
                                This source will automatically inherit the factory's standard shift pattern.
                            </p>
                        ) : (
                            <div className="ml-6 mt-2">
                                <p className="text-xs text-warning flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Starting with empty schedule
                                </p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-3 bg-danger/10 text-danger border border-danger/20 text-sm rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !canCreate}
                            className="bg-brand hover:bg-brand-dark text-white gap-2"
                        >
                            {isSubmitting ? 'Creating...' : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Add Source</span>
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
