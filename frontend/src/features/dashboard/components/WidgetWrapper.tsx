import { Settings, Trash2, Move } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useDashboardSafe } from '../context/DashboardContext';
import { useTranslation } from 'react-i18next';

export type WidgetDensity = 'default' | 'compact' | 'minimal';

export interface WidgetWrapperProps {
    id?: string;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    density?: WidgetDensity;
    isMock?: boolean;
    editMode?: boolean;
    onRemove?: () => void;
    // Optional context injection for static usage
    openSettings?: (id: string) => void;
    actions?: React.ReactNode;
    iconBgColor?: string;
    className?: string;
    isLoading?: boolean;
    children: React.ReactNode;
}

/**
 * Standardized wrapper for dashboard widgets.
 * Provides consistent header styling across three density modes:
 * - default: Full header with icon, title, subtitle, and actions
 * - compact: Reduced header on single line, no subtitle
 * - minimal: No header, just a hoverable corner icon with tooltip
 */
export const WidgetWrapper: React.FC<WidgetWrapperProps> = ({
    id,
    title,
    subtitle,
    icon,
    density = 'default',
    isMock = false,
    editMode = false,
    onRemove,
    openSettings, // Passed prop takes precedence
    actions,
    iconBgColor = 'bg-surface-subtle',
    className,
    isLoading = false,
    children,
}) => {
    const { t } = useTranslation();
    // 1. Get Context Safely
    const context = useDashboardSafe();

    // 2. Resolve final handlers (Prop > Context > None)
    const handleOpenSettings = openSettings || context?.openSettings;
    const canSettings = !!(id && handleOpenSettings);


    // Standard Card Classes - Uses semantic colors for dark mode
    const cardClasses = "bg-surface text-text-main border border-border shadow-sm";

    // Reusable Loading Overlay
    const LoadingOverlay = () => (
        <div className="absolute inset-0 bg-surface/50 backdrop-blur-[1px] z-20 flex items-center justify-center rounded-lg transition-all duration-300">
            <div className="flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
            </div>
        </div>
    );

    // Minimal mode: Overlay icon in corner
    if (density === 'minimal') {
        return (
            <div className={cn(cardClasses, "rounded-lg h-full relative overflow-hidden group", className)}>
                {/* Loading Overlay */}
                {isLoading && <LoadingOverlay />}

                {/* Overlay icon with tooltip */}
                {icon && (
                    <div
                        className="absolute top-2 end-2 p-1 bg-surface/80 rounded opacity-50 hover:opacity-100 transition-opacity cursor-help z-30 group/icon"
                        title={t(title as any) || title}
                    >
                        <div className="w-3.5 h-3.5 text-text-muted">
                            {icon}
                        </div>
                        {/* Tooltip on hover - expands to the left */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 me-1 px-2 py-1 bg-surface-elevated text-text-main text-[10px] rounded whitespace-nowrap opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none border border-border shadow-lg">
                            {t(title as any) || title}
                        </div>
                    </div>
                )}
                {/* Action Group - Top Left (Minimal) */}
                {canSettings && (
                    <div className="absolute top-2 start-2 flex items-center gap-1 z-30 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                            onClick={() => id && handleOpenSettings(id)}
                            className="p-1 hover:bg-surface-subtle rounded text-text-muted hover:text-text-main"
                            title={t('widgets.common.settings')}
                        >
                            <Settings size={14} />
                        </button>
                        {editMode && onRemove && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                className="p-1 hover:bg-danger/10 rounded text-text-muted hover:text-danger"
                                title={t('widgets.common.remove_widget')}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                )}
                <div className="h-full p-3">
                    {children}
                </div>

                {/* Drag Overlay (Visual Cue + Interaction Blocker) */}
                {editMode && (
                    <div className="absolute inset-0 z-10 bg-transparent cursor-move group hover:bg-white/5 transition-colors border-2 border-transparent hover:border-primary/20 rounded-lg pointer-events-auto">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface shadow-sm rounded-full p-2 text-primary">
                            <Move className="w-4 h-4" />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Compact mode: Single-line header with icon on right
    if (density === 'compact') {
        return (
            <div className={cn(cardClasses, "rounded-lg h-full flex flex-col overflow-hidden group", className)}>
                {/* Loading Overlay */}
                {isLoading && <LoadingOverlay />}

                <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 shrink-0 border-b border-transparent">
                    <span className="text-xs font-semibold text-text-main truncate">
                        {t(title as any) || title}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 relative z-30">
                        {canSettings && (
                            <button
                                onClick={() => id && handleOpenSettings(id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-surface-subtle rounded transition-all"
                                title={t('widgets.common.settings' as any)}
                            >
                                <Settings size={14} className="text-text-muted hover:text-text-main" />
                            </button>
                        )}
                        {id && editMode && onRemove && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-danger/10 rounded transition-all"
                                title={t('widgets.common.remove_widget')}
                            >
                                <Trash2 size={14} className="text-text-muted hover:text-danger" />
                            </button>
                        )}
                        {actions}
                        {icon && (
                            <div className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity cursor-help" title={t(title as any) || title}>
                                <div className="w-3.5 h-3.5">
                                    {icon}
                                </div>
                            </div>
                        )}
                        {isMock && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-warning bg-warning/10 border border-warning/20 rounded uppercase">
                                {t('widgets.common.demo' as any)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex-1 min-h-[100px] px-3 pb-2.5">
                    {children}
                </div>

                {/* Drag Overlay (Visual Cue + Interaction Blocker) */}
                {editMode && (
                    <div className="absolute inset-0 z-10 bg-transparent cursor-move group hover:bg-white/5 transition-colors border-2 border-transparent hover:border-primary/20 rounded-lg pointer-events-auto">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface shadow-sm rounded-full p-2 text-primary">
                            <Move className="w-4 h-4" />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Default mode: Full header
    return (
        <div className={cn(cardClasses, "rounded-lg h-full flex flex-col overflow-hidden group", className)}>
            {/* Loading Overlay */}
            {isLoading && <LoadingOverlay />}

            <div className="flex items-center justify-between gap-2 px-6 pt-6 pb-2 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    {icon && (
                        <div className={cn("p-2 rounded-lg shrink-0 flex items-center justify-center", iconBgColor)}>
                            <div className="w-5 h-5 flex items-center justify-center">
                                {icon}
                            </div>
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-text-main truncate">
                            {t(title as any) || title}
                        </h3>
                        {subtitle && (
                            <p className="text-xs text-text-muted truncate mt-0.5">
                                {t(subtitle as any) || subtitle}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 relative z-30">
                    {canSettings && (
                        <button
                            onClick={() => id && handleOpenSettings(id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-surface-subtle rounded-md transition-all"
                            title={t('widgets.common.settings')}
                        >
                            <Settings size={16} className="text-text-muted hover:text-text-main" />
                        </button>
                    )}
                    {id && editMode && onRemove && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-danger/10 rounded-md transition-all"
                            title={t('widgets.common.remove_widget')}
                        >
                            <Trash2 size={16} className="text-text-muted hover:text-danger" />
                        </button>
                    )}
                    {isMock && (
                        <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider text-warning bg-warning/10 border border-warning/20 rounded-full uppercase">
                            {t('widgets.common.demo_mode' as any)}
                        </span>
                    )}
                    {actions && (
                        <div className="shrink-0">
                            {actions}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-1 min-h-[150px] px-6 pb-6 relative z-0">
                {children}
            </div>

            {/* Drag Overlay (Visual Cue + Interaction Blocker) */}
            {editMode && (
                <div className="absolute inset-0 z-10 bg-transparent cursor-move group hover:bg-white/5 transition-colors border-2 border-transparent hover:border-primary/20 rounded-lg pointer-events-auto">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface shadow-sm rounded-full p-2 text-primary">
                        <Move className="w-4 h-4" />
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Helper to determine widget density from grid dimensions.
 * @param w - Grid width units
 * @param h - Grid height units
 */
export const getDensity = (w: number, h: number): WidgetDensity => {
    if (h === 1) return 'minimal';
    if (h <= 2 && w <= 3) return 'compact';
    return 'default';
};

export default WidgetWrapper;
