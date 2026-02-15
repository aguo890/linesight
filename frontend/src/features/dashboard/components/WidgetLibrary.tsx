/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    return (
        <RightSidebarShell
            isOpen={isOpen}
            onClose={onClose}
            title={t('widgets.library.title')}
            subtitle={t('widgets.library.subtitle')}
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
