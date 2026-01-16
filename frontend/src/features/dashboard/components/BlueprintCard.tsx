import React from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, ShieldCheck, Users, TrendingUp, ChevronRight } from 'lucide-react';
import type { WidgetBundle, BundleReadiness } from '../registry';

interface BlueprintCardProps {
    bundle: WidgetBundle;
    readiness: BundleReadiness;
    onApply: () => void;
}

// Icon mapping for bundle icons
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    Zap,
    ShieldCheck,
    Users,
    TrendingUp,
};

export const BlueprintCard: React.FC<BlueprintCardProps> = ({
    bundle,
    readiness,
    onApply
}) => {
    const { t } = useTranslation();
    const Icon = ICON_MAP[bundle.icon] || Zap;
    const isFullyReady = readiness.isReady;
    const isPartiallyReady = readiness.percentage > 0 && !isFullyReady;

    const categoryColors = {
        Recommended: { bg: 'from-blue-500 to-indigo-600', badge: 'bg-blue-100 text-blue-800' },
        Operations: { bg: 'from-emerald-500 to-teal-600', badge: 'bg-emerald-100 text-emerald-800' },
        Strategy: { bg: 'from-purple-500 to-violet-600', badge: 'bg-purple-100 text-purple-800' },
    };

    const colors = categoryColors[bundle.displayCategory] || categoryColors.Recommended;

    return (
        <div
            className={`
                relative overflow-hidden rounded-xl border transition-all duration-300 group
                ${isFullyReady
                    ? 'border-transparent shadow-md hover:shadow-lg cursor-pointer'
                    : 'border-gray-200 opacity-80 hover:opacity-100'
                }
            `}
            onClick={isFullyReady || isPartiallyReady ? onApply : undefined}
        >
            {/* Gradient Background */}
            <div className={`
                absolute inset-0 bg-gradient-to-br ${colors.bg} opacity-90
                ${!isFullyReady && 'grayscale'}
            `} />

            {/* Content */}
            <div className="relative z-10 p-5 text-white">
                <div className="flex items-start justify-between mb-3">
                    <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center
                        ${isFullyReady ? 'bg-white/20' : 'bg-white/10'}
                    `}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                        {t(`widgets.bundles.categories.${bundle.displayCategory}` as any)}
                    </span>
                </div>

                <h3 className="text-lg font-bold mb-1">{t(bundle.title as any)}</h3>
                <p className="text-sm text-white/80 mb-4 line-clamp-2">
                    {t(bundle.description as any)}
                </p>

                {/* Readiness Indicator */}
                <div className="space-y-2">
                    {/* Progress Bar */}
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${isFullyReady ? 'bg-white' : 'bg-white/60'}`}
                            style={{ width: `${readiness.percentage}%` }}
                        />
                    </div>

                    {/* Status Text */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-white/70">
                            {readiness.supportedCount}/{readiness.totalCount} widgets ready
                        </span>
                        {isFullyReady && (
                            <span className="flex items-center gap-1 text-white font-medium group-hover:gap-2 transition-all">
                                Apply <ChevronRight className="w-3 h-3" />
                            </span>
                        )}
                        {isPartiallyReady && (
                            <span className="text-white/60">
                                Partial match
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Hover Overlay for Ready Bundles */}
            {isFullyReady && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            )}
        </div>
    );
};
