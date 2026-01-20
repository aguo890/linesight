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
