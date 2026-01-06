import React from 'react';
import { WidgetSelector } from './WidgetSelector';
import { RightSidebarShell } from './RightSidebarShell';

export interface WidgetLibraryProps {
    isOpen: boolean;
    onClose: () => void;
    onAddWidget: (typeId: string) => void;
    availableFields: string[];
    activeWidgets?: string[];
}

export const WidgetLibrary: React.FC<WidgetLibraryProps> = ({
    isOpen,
    onClose,
    onAddWidget,
    availableFields,
    activeWidgets = []
}) => {
    return (
        <RightSidebarShell
            isOpen={isOpen}
            onClose={onClose}
            title="Widget Library"
            subtitle="Choose a widget to add"
            zIndex="z-50" // Lower z-index for library vs settings if needed
        >
            <div className="p-6">
                <WidgetSelector
                    variant="sidebar"
                    availableFields={availableFields}
                    onSelect={onAddWidget}
                    selectedWidgets={activeWidgets}
                />
            </div>
        </RightSidebarShell>
    );
};

export default WidgetLibrary;
