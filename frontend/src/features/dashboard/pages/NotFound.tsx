import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';
import { MainLayout } from '../../../components/layout/MainLayout';
import { OrganizationProvider } from '../../../contexts/OrganizationContext';

const NotFound: React.FC = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const content = (
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <FileQuestion className="w-12 h-12 text-gray-400" />
            </div>

            <h1 className="text-4xl font-bold text-gray-900 mb-2">404 - Page Not Found</h1>
            <p className="text-xl text-gray-600 mb-8 max-w-md">
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center justify-center px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Go Back
                </button>

                <button
                    onClick={() => navigate(token ? '/dashboard' : '/')}
                    className="flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                >
                    <Home className="w-5 h-5 mr-2" />
                    {token ? 'Dashboard Home' : 'Home'}
                </button>
            </div>
        </div>
    );

    if (token) {
        return (
            <OrganizationProvider>
                <MainLayout>
                    {content}
                </MainLayout>
            </OrganizationProvider>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            {content}
        </div>
    );
};

export default NotFound;
