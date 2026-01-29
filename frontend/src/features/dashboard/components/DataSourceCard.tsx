/**
 * Data Source Card Component
 * 
 * Displays data source information and status within a factory.
 * Allows uploading data and managing the source (permission-aware).
 */
import React from 'react';
import { Edit2, Trash2, Activity, Upload, Lock, Database } from 'lucide-react';
import type { DataSource } from '../../../lib/factoryApi';
import { usePermissions } from '../../../hooks/usePermissions';

interface DataSourceCardProps {
    dataSource: DataSource;
    onEdit?: (id: string) => void;
    onDelete?: (id: string) => void;
    onUpload?: (id: string) => void;
}

export const DataSourceCard: React.FC<DataSourceCardProps & { onClick?: (id: string) => void }> = ({
    dataSource,
    onEdit,
    onDelete,
    onUpload,
    onClick
}) => {
    const { canUploadToLine, canUploadAny, canManageInfrastructure } = usePermissions();

    // Determine upload button state
    // Note: canUploadToLine check currently expects a line ID. With the shift to DataSource, 
    // we assume the ID is compatible or the permission hook needs refactor.
    // For now assuming ID compatibility.
    const canUploadThisSource = canUploadToLine(dataSource.id);
    const showUploadButton = canUploadAny && onUpload;
    const isUploadDisabled = showUploadButton && !canUploadThisSource;

    return (
        <div
            onClick={() => onClick?.(dataSource.id)}
            className={`group relative bg-surface rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}
        >
            {/* Top Border Indicator */}
            <div className={`h-1.5 w-full ${dataSource.is_active ? 'bg-brand' : 'bg-border'}`} />

            <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-2 bg-brand/10 rounded-lg group-hover:bg-brand/20 transition-colors">
                        <Database className="w-6 h-6 text-brand" />
                    </div>
                    {dataSource.is_active ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/20">
                            <Activity className="w-3.5 h-3.5 text-success" />
                            <span className="text-xs font-medium text-success">Active</span>
                        </div>
                    ) : (
                        <div className="px-2.5 py-1 rounded-full bg-surface-subtle border border-border">
                            <span className="text-xs font-medium text-text-muted">Inactive</span>
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-text-main mb-1">{dataSource.name}</h3>
                    {dataSource.code && (
                        <p className="text-sm text-text-muted font-mono">{dataSource.code}</p>
                    )}
                </div>

                {dataSource.description && (
                    <div className="mb-4 text-sm text-text-muted bg-surface-subtle px-3 py-2 rounded-md truncate">
                        {dataSource.description}
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-border opacity-60 group-hover:opacity-100 transition-opacity">
                    {/* Upload Button */}
                    {showUploadButton && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (canUploadThisSource) onUpload!(dataSource.id);
                            }}
                            disabled={isUploadDisabled}
                            className={`p-2 rounded-lg transition-colors relative ${isUploadDisabled
                                ? 'text-text-muted/50 cursor-not-allowed bg-surface-subtle'
                                : 'text-text-muted hover:text-success hover:bg-success/10'
                                }`}
                            title={isUploadDisabled ? 'You do not have write access to this source' : 'Upload data'}
                        >
                            {isUploadDisabled ? (
                                <Lock className="w-4 h-4" />
                            ) : (
                                <Upload className="w-4 h-4" />
                            )}
                        </button>
                    )}

                    {/* Edit Button */}
                    {onEdit && canManageInfrastructure && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(dataSource.id); }}
                            className="p-2 text-text-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors"
                            title="Edit source"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    )}

                    {/* Delete Button */}
                    {onDelete && canManageInfrastructure && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(dataSource.id); }}
                            className="p-2 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                            title="Delete source"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
