import React, { useState, useEffect } from 'react';
import TopNav from './TopNav';
import { Sidebar } from './Sidebar';


export const MainLayout: React.FC<{ children: React.ReactNode; disablePadding?: boolean }> = ({ children, disablePadding = false }) => {
    // Lazy initialization to prevent layout shift
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia("(min-width: 768px)").matches === false;
    });

    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        if (typeof window === 'undefined') return true;

        // Check mobile state synchronously
        const mobile = window.matchMedia("(min-width: 768px)").matches === false;
        if (mobile) return false;

        // Check saved preference
        const saved = localStorage.getItem('sidebar-desktop-preference');
        return saved !== null ? JSON.parse(saved) : true;
    });

    const toggleSidebar = () => {
        setIsSidebarOpen((prev: boolean) => {
            const newState = !prev;
            // Only persist preference if we are in desktop mode
            if (!isMobile) {
                localStorage.setItem('sidebar-desktop-preference', JSON.stringify(newState));
            }
            return newState;
        });
    };

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 768px)");

        // Handler for breakpoint crossings
        const handleBreakpointChange = (e: MediaQueryListEvent) => {
            const mobile = !e.matches;
            setIsMobile(mobile);

            if (mobile) {
                // Moving into mobile: always force close
                setIsSidebarOpen(false);
            } else {
                // Moving into desktop: restore saved preference
                const saved = localStorage.getItem('sidebar-desktop-preference');
                setIsSidebarOpen(saved !== null ? JSON.parse(saved) : true);
            }
        };

        // Handler for sidebar toggle event from hamburger menu
        const handleSidebarToggle = (e: Event) => {
            const customEvent = e as CustomEvent<{ isOpen: boolean }>;
            setIsSidebarOpen(customEvent.detail.isOpen);
        };

        mediaQuery.addEventListener("change", handleBreakpointChange);
        window.addEventListener('sidebar-toggle', handleSidebarToggle);

        return () => {
            mediaQuery.removeEventListener("change", handleBreakpointChange);
            window.removeEventListener('sidebar-toggle', handleSidebarToggle);
        };
    }, []);

    const closeSidebar = () => {
        setIsSidebarOpen(false);
    };



    return (
        <div className="h-screen w-full overflow-hidden block md:grid md:grid-cols-[auto_1fr] text-[var(--color-text)] bg-[var(--color-background)] relative">
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden animate-in fade-in duration-300"
                    onClick={closeSidebar}
                />
            )}
            <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
            <div className="flex flex-col h-screen overflow-hidden">
                <TopNav />
                <main className={`flex-1 overflow-y-auto bg-[var(--color-background)] ${disablePadding ? '' : 'p-6'}`}>
                    {children}
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
