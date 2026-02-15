/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const ErrorPage: React.FC = () => {
    const error = useRouteError();
    const { t } = useTranslation();
    let errorMessage: string;
    let errorDetail: string | undefined;

    if (isRouteErrorResponse(error)) {
        errorMessage = error.statusText || `Error ${error.status}`;
        errorDetail = (error.data as any)?.message || JSON.stringify(error.data);
    } else if (error instanceof Error) {
        errorMessage = error.message;
        errorDetail = error.stack;
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else {
        errorMessage = t('components.error_page.unknown_error');
        errorDetail = JSON.stringify(error);
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--color-background)] p-4 text-[var(--color-text)]">
            <div className="bg-[var(--color-surface)] p-8 rounded border border-[var(--color-border)] shadow-lg max-w-md w-full text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h1 className="text-xl font-bold mb-2">{t('components.error_page.title')}</h1>
                <p className="text-[var(--color-text-muted)] mb-6 text-sm">
                    {errorMessage}
                </p>

                {errorDetail && (
                    <div className="text-xs font-mono bg-red-50 text-red-800 p-3 rounded text-left overflow-auto max-h-40 mb-6 whitespace-pre-wrap">
                        {errorDetail}
                    </div>
                )}

                <a href="/" className="inline-block px-4 py-2 bg-[var(--color-primary)] text-white rounded hover:bg-[var(--color-primary-dark)] transition-colors text-sm font-medium">
                    {t('components.error_page.return_home')}
                </a>
            </div>
        </div>
    );
};

export default ErrorPage;
