import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

    const { t } = useTranslation();
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
                            <h2 className="text-xl font-bold text-text-main">{t('org_modals.create_datasource.title')}</h2>
                            <p className="text-sm text-text-muted mt-0.5">
                                {t('org_modals.create_datasource.subtitle', { factoryName })}
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
                            <span className="text-sm font-medium text-text-main">{t('org_modals.create_datasource.source_usage')}</span>
                            <span className={`text-sm font-bold ${canCreate ? 'text-brand' : 'text-danger'}`}>
                                {factoryQuota.current} / {quotaStatus?.lines_per_factory.max}
                            </span>
                        </div>
                        {!canCreate && (
                            <p className="text-xs text-danger mt-1">
                                {t('org_modals.create_datasource.quota_reached')}
                            </p>
                        )}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">{t('org_modals.create_datasource.name_label')} *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-main placeholder:text-text-muted/50 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all"
                            placeholder={t('org_modals.create_datasource.name_placeholder')}
                            disabled={!canCreate || isSubmitting}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-main mb-1">{t('org_modals.create_datasource.code_label')}</label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-main placeholder:text-text-muted/50 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all font-mono"
                                placeholder={t('org_modals.create_datasource.code_placeholder')}
                                disabled={!canCreate || isSubmitting}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-main mb-1">{t('org_modals.create_datasource.specialty_label')}</label>
                            <input
                                type="text"
                                value={specialty}
                                onChange={(e) => setSpecialty(e.target.value)}
                                className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-main placeholder:text-text-muted/50 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all"
                                placeholder={t('org_modals.create_datasource.specialty_placeholder')}
                                disabled={!canCreate || isSubmitting}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-main mb-1">{t('org_modals.create_datasource.description_label')}</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-surface text-text-main placeholder:text-text-muted/50 focus:ring-2 focus:ring-brand focus:border-transparent outline-none transition-all resize-none"
                            placeholder={t('org_modals.create_datasource.description_placeholder')}
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
                                <span className="text-sm font-medium text-text-main">{t('org_modals.create_datasource.use_defaults')}</span>
                            </label>
                            <span className="text-xs text-text-muted">
                                {useDefaults ? t('org_modals.create_datasource.inherit_tooltip') : t('org_modals.create_datasource.custom_tooltip')}
                            </span>
                        </div>

                        {useDefaults ? (
                            <p className="text-xs text-text-muted ml-6">
                                {t('org_modals.create_datasource.inherit_desc')}
                            </p>
                        ) : (
                            <div className="ml-6 mt-2">
                                <p className="text-xs text-warning flex items-center gap-1.5">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {t('org_modals.create_datasource.custom_desc')}
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
                            {t('common.actions.cancel')}
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !canCreate}
                            className="bg-brand hover:bg-brand-dark text-white gap-2"
                        >
                            {isSubmitting ? t('org_modals.create_datasource.submitting') : (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>{t('org_modals.create_datasource.submit_button')}</span>
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
