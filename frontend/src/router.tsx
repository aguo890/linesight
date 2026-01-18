import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { Suspense, lazy } from 'react';
import { useAuth } from './hooks/useAuth';
import { LanguageWrapper } from './components/routing/LanguageWrapper';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('./features/landing/pages/LandingPage'));
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage'));
// DashboardPage is deprecated - /dashboard now redirects to /dashboard/factories
const DynamicDashboardPage = lazy(() => import('./features/dashboard/pages/DynamicDashboardPage'));
const MyDashboardsPage = lazy(() => import('./features/dashboard/pages/MyDashboardsPage'));
const FactoryDetailPage = lazy(() => import('./features/dashboard/pages/FactoryDetailPage'));
const DataSourceDetailPage = lazy(() => import('./features/dashboard/pages/DataSourceDetailPage')); // Updated import
const ProfilePage = lazy(() => import('./features/user/ProfilePage'));
const NotFound = lazy(() => import('./features/dashboard/pages/NotFound'));

// Organization Settings (Hub and Spoke pattern)
const OrgSettingsLayout = lazy(() => import('./features/organization/layouts/OrgSettingsLayout'));
const OrgGeneralPage = lazy(() => import('./features/organization/pages/OrgGeneralPage'));
const OrgMembersPage = lazy(() => import('./features/organization/pages/OrgMembersPage'));
const FactorySelectionPage = lazy(() => import('./features/organization/pages/FactorySelectionPage'));
const FactoryConfigurationPage = lazy(() => import('./features/organization/pages/FactoryConfigurationPage'));
const OrganizationSettingsHub = lazy(() => import('./features/organization/pages/OrganizationSettingsHub'));


// Loading component with skeleton
const PageLoader = () => (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-background)]">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--color-accent)]"></div>
            <p className="text-[var(--color-text-muted)] text-sm">Loading...</p>
        </div>
    </div>
);



// Auth guard component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return (
        <OrganizationProvider>
            {children}
        </OrganizationProvider>
    );
};

// Public route - redirect to factories if already logged in
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = useAuth();
    if (isAuthenticated) {
        return <Navigate to="/dashboard/factories" replace />;
    }
    return <>{children}</>;
};

import ErrorPage from './components/ErrorPage';

// Router configuration
const router = createBrowserRouter([
    // === PUBLIC ROUTES WITH LOCALE PREFIX ===
    // Root redirects to default locale (English)
    {
        path: '/',
        element: <Navigate to="/en" replace />,
    },
    // Locale-prefixed public routes (/:lang)
    {
        path: '/:lang',
        element: <LanguageWrapper />,
        errorElement: <ErrorPage />,
        children: [
            {
                index: true,
                element: (
                    <Suspense fallback={<PageLoader />}>
                        <LandingPage />
                    </Suspense>
                ),
            },
            {
                path: 'login',
                element: (
                    <PublicRoute>
                        <Suspense fallback={<PageLoader />}>
                            <LoginPage />
                        </Suspense>
                    </PublicRoute>
                ),
            },
        ],
    },
    // === PROTECTED APP ROUTES (No locale prefix - uses user preference) ===
    {
        path: '/profile',
        element: (
            <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                    <ProfilePage />
                </Suspense>
            </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
    },
    {
        path: '/organization/settings',
        element: (
            <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                    <OrgSettingsLayout />
                </Suspense>
            </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
        children: [
            {
                index: true,
                element: (
                    <Suspense fallback={<PageLoader />}>
                        <OrganizationSettingsHub />
                    </Suspense>
                ),
            },
            {
                path: 'general',
                element: (
                    <Suspense fallback={<PageLoader />}>
                        <OrgGeneralPage />
                    </Suspense>
                ),
            },
            {
                path: 'members',
                element: (
                    <Suspense fallback={<PageLoader />}>
                        <OrgMembersPage />
                    </Suspense>
                ),
            },
            {
                path: 'factories',
                children: [
                    {
                        index: true,
                        element: (
                            <Suspense fallback={<PageLoader />}>
                                <FactorySelectionPage />
                            </Suspense>
                        ),
                    },
                    {
                        path: ':factoryId',
                        element: (
                            <Suspense fallback={<PageLoader />}>
                                <FactoryConfigurationPage />
                            </Suspense>
                        ),
                    },
                ],
            },
        ],
    },
    // DEPRECATED: /dashboard now redirects to /dashboard/factories
    // The old overview page (DashboardPage) is no longer the default entry point
    {
        path: '/dashboard',
        element: <Navigate to="/dashboard/factories" replace />,
    },
    {
        path: '/dashboard/factories/:factoryId',
        element: (
            <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                    <FactoryDetailPage />
                </Suspense>
            </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
    },
    {
        path: '/dashboard/factories/:factoryId/lines/:lineId',
        element: (
            <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                    <DataSourceDetailPage /> {/* Updated Element */}
                </Suspense>
            </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
    },
    {
        path: '/dashboard/factories',
        element: (
            <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                    <MyDashboardsPage />
                </Suspense>
            </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
    },
    {
        path: '/dashboard/factories/:factoryId/dashboards/:dashboardId',
        element: (
            <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                    <DynamicDashboardPage />
                </Suspense>
            </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
    },
    {
        path: '/dashboard/dynamic',
        element: (
            <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                    <DynamicDashboardPage />
                </Suspense>
            </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
    },
    {
        path: '/404',
        element: (
            <Suspense fallback={<PageLoader />}>
                <NotFound />
            </Suspense>
        ),
    },
    {
        path: '*',
        element: <Navigate to="/404" replace />,
    },
]);

export const AppRouter = () => <RouterProvider router={router} />;
