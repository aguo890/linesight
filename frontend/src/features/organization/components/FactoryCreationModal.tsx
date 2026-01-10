/**
 * Factory Creation Modal Component
 * 
 * Modal for creating new factories and their initial data source.
 * Extracted from DashboardWizard to provide dedicated factory management.
 */
import React, { useState, useEffect } from 'react';
import { X, Factory as FactoryIcon, AlertCircle, CheckCircle } from 'lucide-react';
import { createFactory, createDataSource } from '../../../lib/factoryApi';
import type { QuotaStatus } from '../../../lib/quotaApi';

interface FactoryCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    quotaStatus: QuotaStatus | null;
}

export const FactoryCreationModal: React.FC<FactoryCreationModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    quotaStatus
}) => {
    const [factoryName, setFactoryName] = useState('');
    const [factoryCode, setFactoryCode] = useState('');
    const [sourceName, setSourceName] = useState('');
    const [sourceSpecialty, setSourceSpecialty] = useState('');
    const [sourceDescription, setSourceDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<{
        factoryName?: string;
        sourceName?: string;
    }>({});

    // Reset form when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setFactoryName('');
            setFactoryCode('');
            setSourceName('');
            setSourceSpecialty('');
            setSourceDescription('');
            setError(null);
            setValidationErrors({});
        }
    }, [isOpen]);

    const validateForm = (): boolean => {
        const errors: { factoryName?: string; sourceName?: string } = {};

        if (!factoryName.trim()) {
            errors.factoryName = 'Factory name is required';
        }

        if (!sourceName.trim()) {
            errors.sourceName = 'Data Source name is required';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate form
        if (!validateForm()) {
            return;
        }

        // Check quota
        if (!quotaStatus?.factories.can_create) {
            setError('Factory quota limit reached. Please upgrade your plan to create more factories.');
            return;
        }

        setIsSubmitting(true);

        try {
            // Step 1: Create Factory
            const factory = await createFactory({
                name: factoryName.trim(),
                code: factoryCode.trim() || undefined,
                country: 'US', // Default for now
                timezone: 'UTC' // Default for now
            });

            // Step 2: Create initial data source
            await createDataSource(factory.id, {
                name: sourceName.trim(),
                description: sourceDescription.trim() || undefined,
                specialty: sourceSpecialty.trim() || undefined
            });

            // Success!
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to create factory:', err);
            setError(err.response?.data?.detail || 'Failed to create factory. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const canCreate = quotaStatus?.factories.can_create ?? true;

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            data-testid="factory-modal"
        >
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <FactoryIcon className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Create New Factory</h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                Set up a new factory with an initial data source
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        disabled={isSubmitting}
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>


                {/* Scrollable Content Area */}
                <div className="overflow-y-auto flex-1">
                    {/* Quota Status */}
                    {quotaStatus && (
                        <div className={`mx-6 mt-4 p-3 rounded-lg border ${canCreate
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-orange-50 border-orange-200'
                            }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900">
                                        {quotaStatus.subscription_tier.charAt(0).toUpperCase() + quotaStatus.subscription_tier.slice(1)} Plan
                                    </span>
                                    <span className="text-xs text-gray-600">
                                        • {quotaStatus.factories.current}/{quotaStatus.factories.max} Factories
                                    </span>
                                </div>
                                {!canCreate && (
                                    <span className="text-xs text-orange-600 font-medium">Quota Reached</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <form id="factory-creation-form" onSubmit={handleSubmit} className="p-6">
                        <div className="space-y-4">
                            {/* Factory Name */}
                            <div>
                                <label htmlFor="factoryName" className="block text-sm font-medium text-gray-700 mb-2">
                                    Factory Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="factoryName"
                                    data-testid="factory-name-input"
                                    type="text"
                                    value={factoryName}
                                    onChange={(e) => setFactoryName(e.target.value)}
                                    placeholder="e.g. Gigafactory Texas"
                                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${validationErrors.factoryName ? 'border-red-300' : 'border-gray-300'
                                        }`}
                                    disabled={isSubmitting || !canCreate}
                                />
                                {validationErrors.factoryName && (
                                    <p className="mt-1 text-xs text-red-600">{validationErrors.factoryName}</p>
                                )}
                            </div>

                            {/* Factory Code (Optional) */}
                            <div>
                                <label htmlFor="factoryCode" className="block text-sm font-medium text-gray-700 mb-2">
                                    Factory Code <span className="text-gray-400 text-xs">(optional)</span>
                                </label>
                                <input
                                    id="factoryCode"
                                    data-testid="factory-code-input"
                                    type="text"
                                    value={factoryCode}
                                    onChange={(e) => setFactoryCode(e.target.value)}
                                    placeholder="e.g. GTX-01"
                                    maxLength={10}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono"
                                    disabled={isSubmitting || !canCreate}
                                />
                                <p className="mt-1 text-xs text-gray-500">Short identifier for this factory</p>
                            </div>

                            {/* Data Source Name */}
                            <div>
                                <label htmlFor="sourceName" className="block text-sm font-medium text-gray-700 mb-2">
                                    Initial Data Source <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="sourceName"
                                    data-testid="data-source-input"
                                    type="text"
                                    value={sourceName}
                                    onChange={(e) => setSourceName(e.target.value)}
                                    placeholder="e.g. Assembly Line A"
                                    className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${validationErrors.sourceName ? 'border-red-300' : 'border-gray-300'
                                        }`}
                                    disabled={isSubmitting || !canCreate}
                                />
                                {validationErrors.sourceName && (
                                    <p className="mt-1 text-xs text-red-600">{validationErrors.sourceName}</p>
                                )}
                            </div>

                            {/* Data Source Specialty */}
                            <div>
                                <label htmlFor="sourceSpecialty" className="block text-sm font-medium text-gray-700 mb-2">
                                    Source Specialty <span className="text-gray-400 text-xs">(optional)</span>
                                </label>
                                <input
                                    id="sourceSpecialty"
                                    type="text"
                                    value={sourceSpecialty}
                                    onChange={(e) => setSourceSpecialty(e.target.value)}
                                    placeholder="e.g. Assembly, Testing, Packaging"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    disabled={isSubmitting || !canCreate}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Primary function or type of this source
                                </p>
                            </div>

                            {/* Data Source Description */}
                            <div>
                                <label htmlFor="sourceDescription" className="block text-sm font-medium text-gray-700 mb-2">
                                    Source Description <span className="text-gray-400 text-xs">(optional)</span>
                                </label>
                                <textarea
                                    id="sourceDescription"
                                    value={sourceDescription}
                                    onChange={(e) => setSourceDescription(e.target.value)}
                                    placeholder="e.g. Primary assembly line for sportswear"
                                    rows={2}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    disabled={isSubmitting || !canCreate}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Briefly describe the function of this source
                                </p>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            )}

                            {/* Success indicator while submitting */}
                            {isSubmitting && (
                                <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                                    <p className="text-sm text-blue-700">Creating factory and data source...</p>
                                </div>
                            )}
                        </div>
                    </form>
                </div>
                {/* End Scrollable Content Area */}

                {/* Sticky Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t flex-shrink-0 bg-white rounded-b-lg">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="factory-creation-form"
                        data-testid="submit-factory-btn"
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSubmitting || !canCreate}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                <span>Creating...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                <span>Create Factory</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
