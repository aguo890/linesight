import { useCallback, type ErrorInfo } from 'react';

export interface WidgetErrorContext {
    id: string;
    type: string;
    meta?: Record<string, unknown>;
}

export const useWidgetLogger = () => {
    const logError = useCallback((error: Error, errorInfo: ErrorInfo, context: WidgetErrorContext) => {
        // 1. Development Logging: Rich console output
        if (process.env.NODE_ENV === 'development') {
            console.group(`🚨 Widget Failure: [${context.type}]`);
            console.log('%cWidget ID:', 'font-weight: bold; color: #7f1d1d', context.id);
            console.error(error);
            console.debug('Component Stack:', errorInfo.componentStack);
            if (context.meta) {
                console.debug('Metadata:', context.meta);
            }
            console.groupEnd();
        }

        // 2. Production Logging: Integration point for Sentry/Datadog
        // In a real app, you would uncomment this:
        /*
        if (window.Sentry) {
            window.Sentry.withScope((scope) => {
                scope.setTag("widget_type", context.type);
                scope.setTag("widget_id", context.id);
                scope.setExtra("componentStack", errorInfo.componentStack);
                window.Sentry.captureException(error);
            });
        }
        */
    }, []);

    return { logError };
};
