/**
 * Organization Settings Layout
 * 
 * Clean full-width container for settings pages.
 * Uses "Drill-Down" pattern: Hub (card grid) → Sub-page (with back button).
 * No nested sidebar - navigation handled by Hub and SettingsPageHeader.
 */

import React from 'react';
import { Outlet } from 'react-router-dom';
import { MainLayout } from '../../../components/layout/MainLayout';

const OrgSettingsLayout: React.FC = () => {
    return (
        <MainLayout disablePadding>
            <div className="min-h-[calc(100vh-4rem)] bg-[var(--color-background)] p-8">
                <Outlet />
            </div>
        </MainLayout>
    );
};

export default OrgSettingsLayout;

