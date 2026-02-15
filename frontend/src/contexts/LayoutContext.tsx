/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { createContext, useContext } from 'react';

interface LayoutContextType {
    isSidebarOpen: boolean;
    isSidebarTransitioning: boolean;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export const LayoutProvider: React.FC<{
    children: React.ReactNode;
    isSidebarOpen: boolean;
    isSidebarTransitioning: boolean;
}> = ({ children, isSidebarOpen, isSidebarTransitioning }) => {
    return (
        <LayoutContext.Provider value={{ isSidebarOpen, isSidebarTransitioning }}>
            {children}
        </LayoutContext.Provider>
    );
};

export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (context === undefined) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
};
