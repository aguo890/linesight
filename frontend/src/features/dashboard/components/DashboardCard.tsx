import React from 'react';
import {
    LayoutGrid,
    Trash2,
    Grid3x3,
    Calendar,
    ChevronRight
} from 'lucide-react';
import { AutoFlipIcon } from '@/components/common/AutoFlipIcon';
import { useGetDataSourceApiV1DataSourcesDataSourceIdGet } from '../../../api/endpoints/data-sources/data-sources';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Dashboard } from '../types';
import { useDateFormatter } from '@/hooks/useDateFormatter';

interface DashboardCardProps {
    dashboard: Dashboard;
    onDelete: (id: string) => void;
    onClick: (id: string) => void;
}

export const DashboardCard: React.FC<DashboardCardProps> = ({ dashboard, onDelete, onClick }) => {
    const { formatDate } = useDateFormatter();
    // Computed values
    const layoutConfig = dashboard.layout_config ? JSON.parse(dashboard.layout_config) : null;
    const widgetCount = layoutConfig?.layouts?.length || 0;
    const lastModified = dashboard.updated_at ? formatDate(dashboard.updated_at) : 'Never';

    // Fetch Data Source Name if ID exists
    const { data: dataSource, isLoading: isDataSourceLoading } = useGetDataSourceApiV1DataSourcesDataSourceIdGet(
        dashboard.data_source_id!,
        {
            query: {
                enabled: !!dashboard.data_source_id,
                staleTime: 1000 * 60 * 5 // Cache for 5 minutes
            }
        }
    );

    const dataSourceName = dashboard.data_source_id
        ? (isDataSourceLoading ? 'Loading Source...' : (dataSource?.source_name || 'Unknown Source'))
        : 'Global / No Source';

    return (
        <div
            onClick={() => onClick(dashboard.id)}
            className="group relative bg-surface rounded-xl border border-border p-5 hover:shadow-lg hover:border-brand/40 transition-all cursor-pointer overflow-hidden"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-brand/10 border border-brand/20 rounded-lg group-hover:bg-brand/20 transition-colors">
                    <LayoutGrid className="w-5 h-5 text-brand" />
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(dashboard.id); }}
                    className="p-1.5 text-text-muted/50 hover:text-error hover:bg-error/10 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            <h3 className="font-semibold text-text-main mb-1 group-hover:text-brand transition-colors">
                {dashboard.name}
            </h3>

            <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Grid3x3 className="w-3.5 h-3.5 text-text-muted" />
                    <span>{widgetCount} Widgets</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                    <Calendar className="w-3.5 h-3.5 text-text-muted" />
                    <span>{lastModified}</span>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                {isDataSourceLoading ? (
                    <Skeleton className="h-4 w-24" />
                ) : (
                    <span className="text-xs font-medium text-text-muted truncate max-w-[150px]" title={dataSourceName}>
                        {dataSourceName}
                    </span>
                )}
                <AutoFlipIcon
                    icon={ChevronRight}
                    className="w-4 h-4 text-text-muted/50 group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
                />
            </div>
        </div>
    );
};
