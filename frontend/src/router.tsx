import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { OrganizationProvider } from './contexts/OrganizationContext';
import { Suspense, lazy } from 'react';
import { useAuth } from './hooks/useAuth';

// Lazy load pages for code splitting
const LandingPage = lazy(() => import('./features/landing/pages/LandingPage'));
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage'));
const DashboardPage = lazy(() => import('./features/dashboard/pages/DashboardPage'));
const DynamicDashboardPage = lazy(() => import('./features/dashboard/pages/DynamicDashboardPage'));
const MyDashboardsPage = lazy(() => import('./features/dashboard/pages/MyDashboardsPage'));
const FactoryDetailPage = lazy(() => import('./features/dashboard/pages/FactoryDetailPage'));
const ProductionLinePage = lazy(() => import('./features/dashboard/pages/ProductionLinePage'));
const ProfilePage = lazy(() => import('./features/user/ProfilePage'));
const NotFound = lazy(() => import('./features/dashboard/pages/NotFound'));


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

// Public route - redirect to dashboard if already logged in
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated } = useAuth();
    if (isAuthenticated) {
        return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
};

import ErrorPage from './components/ErrorPage';

// Router configuration
const router = createBrowserRouter([
    {
        path: '/',
        element: (
            <Suspense fallback={<PageLoader />}>
                <LandingPage />
            </Suspense>
        ),
        errorElement: <ErrorPage />,
    },
    {
        path: '/login',
        element: (
            <PublicRoute>
                <Suspense fallback={<PageLoader />}>
                    <LoginPage />
                </Suspense>
            </PublicRoute>
        ),
        errorElement: <ErrorPage />,
    },
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
        path: '/dashboard',
        element: (
            <ProtectedRoute>
                <Suspense fallback={<PageLoader />}>
                    <DashboardPage />
                </Suspense>
            </ProtectedRoute>
        ),
        errorElement: <ErrorPage />,
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
                    <ProductionLinePage />
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
