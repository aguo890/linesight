import React from 'react';
import { AlertTriangle, Crown, X } from 'lucide-react';

interface QuotaWarningProps {
    type: 'factory' | 'line';
    current: number;
    max: number;
    onUpgrade?: () => void;
    onDismiss?: () => void;
}

export const QuotaWarning: React.FC<QuotaWarningProps> = ({
    type,
    current,
    max,
    onUpgrade,
    onDismiss
}) => {
    const isAtLimit = current >= max;
    const isNearLimit = current >= max * 0.8 && !isAtLimit;

    if (!isNearLimit && !isAtLimit) return null;

    const typeLabel = type === 'factory' ? 'factories' : 'production lines';
    const message = isAtLimit
        ? `You've reached your ${typeLabel} limit (${max})`
        : `You're approaching your ${typeLabel} limit (${current}/${max})`;

    return (
        <div className={`rounded-lg p-4 ${isAtLimit
                ? 'bg-red-50 border-2 border-red-200'
                : 'bg-yellow-50 border-2 border-yellow-200'
            } relative`}>
            <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isAtLimit ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                <div className="flex-1">
                    <p className={`text-sm font-semibold ${isAtLimit ? 'text-red-900' : 'text-yellow-900'
                        }`}>
                        {message}
                    </p>
                    <p className={`text-sm mt-1 ${isAtLimit ? 'text-red-700' : 'text-yellow-700'
                        }`}>
                        {isAtLimit
                            ? `Upgrade your plan to create more ${typeLabel}.`
                            : `Consider upgrading to avoid interruptions.`
                        }
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {onUpgrade && (
                        <button
                            onClick={onUpgrade}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm text-sm font-medium"
                        >
                            <Crown className="w-4 h-4" />
                            <span>Upgrade</span>
                        </button>
                    )}
                    {onDismiss && !isAtLimit && (
                        <button
                            onClick={onDismiss}
                            className="p-1.5 hover:bg-yellow-100 rounded transition-colors"
                            aria-label="Dismiss warning"
                        >
                            <X className="w-4 h-4 text-yellow-600" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
