/**
 * Data Source Card Component
 * 
 * Displays data source information and status within a factory.
 * Allows uploading data and managing the source (permission-aware).
 */
import React from 'react';
import { Settings, Edit2, Trash2, Activity, Upload, Lock, Database } from 'lucide-react';
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
            className={`group relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}
        >
            {/* Top Border Indicator */}
            <div className={`h-1.5 w-full ${dataSource.is_active ? 'bg-blue-500' : 'bg-gray-300'}`} />

            <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                        <Database className="w-6 h-6 text-blue-600" />
                    </div>
                    {dataSource.is_active ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-100">
                            <Activity className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-xs font-medium text-green-700">Active</span>
                        </div>
                    ) : (
                        <div className="px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200">
                            <span className="text-xs font-medium text-gray-600">Inactive</span>
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{dataSource.name}</h3>
                    {dataSource.code && (
                        <p className="text-sm text-gray-500 font-mono">{dataSource.code}</p>
                    )}
                </div>

                {dataSource.description && (
                    <div className="mb-4 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md truncate">
                        {dataSource.description}
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100 opacity-60 group-hover:opacity-100 transition-opacity">
                    {/* Upload Button */}
                    {showUploadButton && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (canUploadThisSource) onUpload!(dataSource.id);
                            }}
                            disabled={isUploadDisabled}
                            className={`p-2 rounded-lg transition-colors relative ${isUploadDisabled
                                ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
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
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit source"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    )}

                    {/* Delete Button */}
                    {onDelete && canManageInfrastructure && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(dataSource.id); }}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
