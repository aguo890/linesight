import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, AlertCircle } from 'lucide-react';
import { updateFactory } from '@/lib/factoryApi';

interface FactoryEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    factory: {
        id: string;
        name: string;
        code?: string;
    } | null;
}

export const FactoryEditModal: React.FC<FactoryEditModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    factory
}) => {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { t } = useTranslation();

    useEffect(() => {
        if (isOpen && factory) {
            setName(factory.name);
            setCode(factory.code || '');
            setError(null);
        }
    }, [isOpen, factory]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!factory) return;

        setIsSubmitting(true);
        setError(null);

        try {
            await updateFactory(factory.id, {
                name: name.trim(),
                code: code.trim() || undefined
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to update factory:', err);
            setError(err.response?.data?.detail || 'Failed to update factory');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !factory) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-lg shadow-xl max-w-md w-full">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h3 className="text-lg font-semibold text-text-main">{t('org_modals.edit_factory.title')}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-surface-subtle rounded-full transition-colors"
                        disabled={isSubmitting}
                    >
                        <X className="w-5 h-5 text-text-muted" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-text-main mb-2">
                            {t('org_modals.edit_factory.name_label')}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="w-full px-3 py-2 bg-surface border border-border rounded-md focus:ring-2 focus:ring-brand/20 focus:border-brand text-text-main placeholder:text-text-muted"
                            disabled={isSubmitting}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-text-main mb-2">
                            {t('org_modals.edit_factory.code_label')}
                        </label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="w-full px-3 py-2 bg-surface border border-border rounded-md focus:ring-2 focus:ring-brand/20 focus:border-brand font-mono text-text-main placeholder:text-text-muted"
                            disabled={isSubmitting}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-danger/10 text-danger text-sm rounded-md flex items-center gap-2 border border-danger/20">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-text-main hover:bg-surface-subtle rounded-md transition-colors"
                            disabled={isSubmitting}
                        >
                            {t('common.actions.cancel')}
                        </button>
                        <button
                            type="submit"
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-dark rounded-md disabled:opacity-50 transition-colors"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? t('org_modals.edit_factory.submitting_button') : t('org_modals.edit_factory.submit_button')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
