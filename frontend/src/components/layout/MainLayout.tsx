import React, { useState, useEffect } from 'react';
import TopNav from './TopNav';
import { Sidebar } from './Sidebar';
import { useTranslation } from 'react-i18next';

export const MainLayout: React.FC<{ children: React.ReactNode; disablePadding?: boolean }> = ({ children, disablePadding = false }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('sidebar-open');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        const handleToggle = (e: CustomEvent) => setIsSidebarOpen(e.detail.isOpen);
        window.addEventListener('sidebar-toggle', handleToggle as EventListener);
        return () => window.removeEventListener('sidebar-toggle', handleToggle as EventListener);
    }, []);

    // Handle RTL direction
    const { i18n } = useTranslation();
    useEffect(() => {
        const dir = i18n.dir(i18n.language);
        document.documentElement.dir = dir;
        document.documentElement.lang = i18n.language;
    }, [i18n.language, i18n]);

    return (
        <div className="h-screen flex flex-col text-[var(--color-text)] bg-[var(--color-background)]">
            <Sidebar />
            <TopNav />
            <div className={`flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ms-64' : 'ms-[70px]'}`}>
                <main className={`h-[calc(100vh-4rem)] overflow-y-auto bg-[var(--color-background)] ${disablePadding ? '' : 'p-6'}`}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
