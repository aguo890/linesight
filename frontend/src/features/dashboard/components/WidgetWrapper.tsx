import { Settings, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useDashboardSafe } from '../context/DashboardContext';

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
    iconBgColor = 'bg-slate-100',
    className,
    children,
}) => {
    // 1. Get Context Safely
    const context = useDashboardSafe();

    // 2. Resolve final handlers (Prop > Context > None)
    const handleOpenSettings = openSettings || context?.openSettings;
    const canSettings = !!(id && handleOpenSettings);


    // Standard Card Classes (mimicking Card.tsx to ensure theme consistency)
    const cardClasses = "bg-white text-slate-950 border border-slate-200 shadow-sm";

    // Minimal mode: Overlay icon in corner
    if (density === 'minimal') {
        return (
            <div className={cn(cardClasses, "rounded-lg h-full relative overflow-hidden group", className)}>
                {/* Overlay icon with tooltip */}
                {icon && (
                    <div
                        className="absolute top-2 right-2 p-1 bg-white/80 rounded opacity-50 hover:opacity-100 transition-opacity cursor-help z-10 group/icon"
                        title={title}
                    >
                        <div className="w-3.5 h-3.5 text-slate-500">
                            {icon}
                        </div>
                        {/* Tooltip on hover - expands to the left */}
                        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-1 px-2 py-1 bg-slate-800 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none">
                            {title}
                        </div>
                    </div>
                )}
                {/* Action Group - Top Left (Minimal) */}
                {canSettings && (
                    <div className="absolute top-2 left-2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                            onClick={() => id && handleOpenSettings(id)}
                            className="p-1 hover:bg-gray-200 rounded text-slate-400 hover:text-slate-700"
                            title="Settings"
                        >
                            <Settings size={14} />
                        </button>
                        {editMode && onRemove && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                                title="Remove Widget"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                )}
                <div className="h-full p-3">
                    {children}
                </div>
            </div>
        );
    }

    // Compact mode: Single-line header with icon on right
    if (density === 'compact') {
        return (
            <div className={cn(cardClasses, "rounded-lg h-full flex flex-col overflow-hidden group", className)}>
                <div className="flex items-center justify-between gap-1.5 px-3 py-1.5 shrink-0 border-b border-transparent">
                    <span className="text-xs font-semibold text-slate-700 truncate">
                        {title}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                        {canSettings && (
                            <button
                                onClick={() => id && handleOpenSettings(id)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                                title="Settings"
                            >
                                <Settings size={14} className="text-gray-400 hover:text-gray-700" />
                            </button>
                        )}
                        {id && editMode && onRemove && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                                title="Remove Widget"
                            >
                                <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                            </button>
                        )}
                        {actions}
                        {icon && (
                            <div className="p-1 rounded opacity-60 hover:opacity-100 transition-opacity cursor-help" title={title}>
                                <div className="w-3.5 h-3.5">
                                    {icon}
                                </div>
                            </div>
                        )}
                        {isMock && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-orange-600 bg-orange-100 border border-orange-200 rounded uppercase">
                                Demo
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex-1 min-h-[100px] px-3 pb-2.5">
                    {children}
                </div>
            </div>
        );
    }

    // Default mode: Full header
    return (
        <div className={cn(cardClasses, "rounded-lg h-full flex flex-col overflow-hidden group", className)}>
            <div className="flex items-center justify-between gap-2 px-6 pt-6 pb-2 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    {icon && (
                        <div className={cn("p-2 rounded-lg shrink-0", iconBgColor)}>
                            <div className="w-5 h-5">
                                {icon}
                            </div>
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-slate-800 truncate">
                            {title}
                        </h3>
                        {subtitle && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {canSettings && (
                        <button
                            onClick={() => id && handleOpenSettings(id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-100 rounded-md transition-all"
                            title="Settings"
                        >
                            <Settings size={16} className="text-slate-400 hover:text-slate-700" />
                        </button>
                    )}
                    {id && editMode && onRemove && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 rounded-md transition-all"
                            title="Remove Widget"
                        >
                            <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
                        </button>
                    )}
                    {isMock && (
                        <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider text-orange-600 bg-orange-100 border border-orange-200 rounded-full uppercase">
                            Demo Mode
                        </span>
                    )}
                    {actions && (
                        <div className="shrink-0">
                            {actions}
                        </div>
                    )}
                </div>
            </div>
            <div className="flex-1 min-h-[150px] px-6 pb-6">
                {children}
            </div>
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
