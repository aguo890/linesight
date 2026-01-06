import React from 'react';
import {
    LayoutGrid,
    Trash2,
    Grid3x3,
    Calendar,
    ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGetDataSourceApiV1DatasourcesDataSourceIdGet } from '../../../api/endpoints/data-sources/data-sources';
import { Skeleton } from '../../../components/ui/Skeleton';
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
    const { data: dataSource, isLoading: isDataSourceLoading, isError } = useGetDataSourceApiV1DatasourcesDataSourceIdGet(
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
            className="group relative bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer overflow-hidden"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg group-hover:bg-indigo-100 transition-colors">
                    <LayoutGrid className="w-5 h-5 text-indigo-600" />
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(dashboard.id); }}
                    className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
                {dashboard.name}
            </h3>

            <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Grid3x3 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{widgetCount} Widgets</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{lastModified}</span>
                </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                {isDataSourceLoading ? (
                    <Skeleton className="h-4 w-24" />
                ) : (
                    <span className="text-xs font-medium text-slate-400 truncate max-w-[150px]" title={dataSourceName}>
                        {dataSourceName}
                    </span>
                )}
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
            </div>
        </div>
    );
};
