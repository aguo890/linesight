/**
 * Production Line Manager Component
 * 
 * Manages production lines within a factory.
 * Phase 2 placeholder - basic implementation for future enhancement.
 */
import React from 'react';
import { Settings, AlertCircle } from 'lucide-react';

interface ProductionLineManagerProps {
    factoryId: string;
    factoryName: string;
}

export const ProductionLineManager: React.FC<ProductionLineManagerProps> = ({
    // factoryId removed
    factoryName
}) => {
    return (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
                <Settings className="w-5 h-5 text-gray-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                    Production Line Management
                </h3>
            </div>

            <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm font-medium text-blue-900">Coming Soon</p>
                    <p className="text-sm text-blue-700 mt-1">
                        Production line management for <strong>{factoryName}</strong> will be available in a future update.
                        For now, you can create lines when creating a new factory.
                    </p>
                </div>
            </div>
        </div>
    );
};
