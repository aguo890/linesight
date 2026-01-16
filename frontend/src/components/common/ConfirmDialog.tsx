/**
 * ConfirmDialog Component
 * 
 * Reusable confirmation dialog for destructive or important actions.
 * Uses a modal pattern with customizable title, message, and actions.
 */
import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';

// =============================================================================
// Types
// =============================================================================

export interface ConfirmDialogProps {
    /** Whether the dialog is open */
    isOpen: boolean;
    /** Close the dialog */
    onClose: () => void;
    /** Confirm action */
    onConfirm: () => void | Promise<void>;
    /** Dialog title */
    title: string;
    /** Dialog message */
    message: string;
    /** Confirm button text */
    confirmLabel?: string;
    /** Cancel button text */
    cancelLabel?: string;
    /** Variant for styling */
    variant?: 'danger' | 'warning' | 'info';
    /** Whether confirm action is in progress */
    isLoading?: boolean;
    /** Message to show on success toast */
    successMessage?: string;
    /** Message to show on cancel toast */
    cancelMessage?: string;
}

// =============================================================================
// Component
// =============================================================================

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel,
    cancelLabel,
    variant = 'danger',
    isLoading = false,
    successMessage,
    cancelMessage,
}) => {
    const { t } = useTranslation();
    const { addToast } = useToast();

    // Resolve labels inside the body to avoid Rules of Hooks violation
    const effectiveConfirmLabel = confirmLabel || t('components.confirm_dialog.confirm');
    const effectiveCancelLabel = cancelLabel || t('components.confirm_dialog.cancel');
    const processingText = t('components.confirm_dialog.please_wait');

    if (!isOpen) return null;

    const handleConfirm = async () => {
        try {
            await onConfirm();
            if (successMessage) {
                addToast(successMessage, 'success');
            }
        } catch (error) {
            console.error('ConfirmDialog action failed:', error);
            addToast(t('common.errors.generic'), 'error');
        }
        onClose();
    };

    const handleCancel = () => {
        if (cancelMessage) {
            addToast(cancelMessage, 'info');
        }
        onClose();
    };

    const variantStyles = {
        danger: {
            icon: 'bg-red-100 text-red-600',
            button: 'bg-red-600 hover:bg-red-700 text-white',
        },
        warning: {
            icon: 'bg-amber-100 text-amber-600',
            button: 'bg-amber-600 hover:bg-amber-700 text-white',
        },
        info: {
            icon: 'bg-sky-100 text-sky-600',
            button: 'bg-sky-600 hover:bg-sky-700 text-white',
        },
    };

    const styles = variantStyles[variant];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleCancel}
            />

            {/* Dialog */}
            <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
                {/* Close button */}
                <button
                    onClick={handleCancel}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Icon */}
                <div className={`w-12 h-12 rounded-full ${styles.icon} flex items-center justify-center mb-4`}>
                    <AlertTriangle className="w-6 h-6" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-600 mb-6">{message}</p>

                {/* Actions */}
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={handleCancel}
                        disabled={isLoading}
                        className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                        {effectiveCancelLabel}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${styles.button}`}
                    >
                        {isLoading ? processingText : effectiveConfirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
