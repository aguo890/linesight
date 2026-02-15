import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';

const OrgSettingsLayout: React.FC = () => {
    const location = useLocation();

    // Detect if we are on a specific factory configuration page
    // Matches: /organization/settings/factories/{someId}
    // Does NOT Match: /organization/settings/factories (the list page)
    const isFactoryConfigPage = /^\/organization\/settings\/factories\/[^/]+$/.test(location.pathname);

    return (
        <MainLayout disablePadding>
            <div className={`min-h-[calc(100vh-4rem)] bg-[var(--color-background)] ${isFactoryConfigPage ? 'p-0' : 'p-8'}`}>
                <Outlet />
            </div>
        </MainLayout>
    );
};

export default OrgSettingsLayout;
