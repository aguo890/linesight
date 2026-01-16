/**
 * Factory Card Component
 * 
 * World-class SaaS design with visual richness:
 * - Pulsing status dot for "alive" feel
 * - Sparkline to imply activity
 * - Modern hover effects
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Factory, Edit2, Trash2, ChevronRight } from 'lucide-react';

interface FactoryCardProps {
    factory: {
        id: string;
        name: string;
        code?: string;
        lineCount: number;
        maxLines: number;
    };
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
    onClick?: (id: string) => void;
}

// Generate a unique sparkline path based on factory id
const generateSparklinePath = (id: string): string => {
    // Use the id to create a pseudo-random but consistent sparkline
    const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed = (hash % 100) / 100;

    // Generate control points based on seed
    const y1 = 30 - seed * 20;
    const y2 = 15 + seed * 15;
    const y3 = 25 - seed * 10;

    return `M0 35 Q 25 ${y1}, 50 ${y2} T 100 ${y3}`;
};

export const FactoryCard: React.FC<FactoryCardProps> = ({
    factory,
    onEdit,
    onDelete,
    onClick
}) => {
    const { t } = useTranslation();
    // Calculate quota percentage for color coding
    const quotaPercentage = (factory.lineCount / factory.maxLines) * 100;

    // Determine status color based on quota usage
    const getStatusColor = () => {
        if (quotaPercentage >= 100) return { dot: 'bg-danger', ping: 'bg-danger/70' };
        if (quotaPercentage >= 80) return { dot: 'bg-warning', ping: 'bg-warning/70' };
        return { dot: 'bg-success', ping: 'bg-success/70' };
    };

    const statusColors = getStatusColor();

    const handleCardClick = () => {
        if (onClick) {
            onClick(factory.id);
        }
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onEdit) {
            onEdit(factory.id);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete(factory.id);
        }
    };

    return (
        <div
            className="group relative bg-surface rounded-xl border border-border hover:shadow-lg transition-all duration-200 cursor-pointer p-5"
            onClick={handleCardClick}
            data-testid={`factory-card-${factory.id}`}
        >
            {/* Top Section: Icon + Name + Status */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    {/* Icon Box */}
                    <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center border border-brand/20 group-hover:bg-brand/20 transition-colors">
                        <Factory className="w-5 h-5 text-brand" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-text-main group-hover:text-brand transition-colors">
                            {factory.name}
                        </h3>
                        {factory.code && (
                            <p className="text-xs text-text-muted font-mono">{factory.code}</p>
                        )}
                    </div>
                </div>

                {/* Pulsing Status Dot */}
                <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusColors.ping} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusColors.dot}`}></span>
                    </span>
                </div>
            </div>

            {/* Metric Row with Sparkline */}
            <div className="flex items-end justify-between mt-6 pt-4 border-t border-border">
                <div>
                    <span className="text-2xl font-bold text-text-main">{factory.lineCount}</span>
                    <span className="text-sm text-text-muted ml-1">{t('dashboard.factory_card.sources_suffix', { max: factory.maxLines })}</span>
                </div>

                {/* Decorative Sparkline */}
                <svg className="w-24 h-8 text-brand opacity-50 group-hover:opacity-80 transition-opacity" viewBox="0 0 100 40">
                    <path
                        d={generateSparklinePath(factory.id)}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </svg>
            </div>

            {/* Action Buttons - Appear on Hover */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && (
                    <button
                        onClick={handleEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-brand hover:bg-brand/10 rounded-md transition-colors"
                        title={t('dashboard.factory_card.edit_title')}
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{t('dashboard.factory_card.edit')}</span>
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-muted hover:text-danger hover:bg-danger/10 rounded-md transition-colors"
                        title={t('dashboard.factory_card.delete_title')}
                        data-testid={`delete-factory-btn-${factory.id}`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('dashboard.factory_card.delete')}</span>
                    </button>
                )}

                {/* Navigate indicator */}
                <div className="ml-auto flex items-center gap-1 text-xs text-text-muted group-hover:text-brand transition-colors">
                    <span>{t('dashboard.factory_card.open')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                </div>
            </div>
        </div>
    );
};
