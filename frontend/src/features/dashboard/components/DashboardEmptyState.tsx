/**
 * DashboardEmptyState Component
 * 
 * Displays when a dashboard has no widgets.
 * Extracted from DynamicDashboardPage for modularity.
 */
import React from 'react';
import { LayoutGrid } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface DashboardEmptyStateProps {
    /** Open the designer/edit mode */
    onOpenDesigner: () => void;
}

// =============================================================================
// Component
// =============================================================================

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
    onOpenDesigner,
}) => {
    return (
        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-slate-200 rounded-3xl m-10">
            <div className="p-6 bg-slate-50 rounded-full">
                <LayoutGrid className="w-12 h-12 text-slate-300" />
            </div>
            <div>
                <h3 className="text-lg font-bold text-slate-900">Your Dashboard is Empty</h3>
                <p className="text-slate-500 max-w-xs">Start building your command center by adding widgets from the designer.</p>
            </div>
            <button onClick={onOpenDesigner} className="text-sky-600 font-bold hover:underline">
                Open Designer
            </button>
        </div>
    );
};

export default DashboardEmptyState;
