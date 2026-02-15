/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { withTranslation, type WithTranslation } from 'react-i18next';

interface Props {
    children?: ReactNode;
    widgetId: string;
    widgetType: string;
    onError?: (error: Error, errorInfo: ErrorInfo, context: { id: string; type: string }) => void;
}

interface CombinedProps extends Props, WithTranslation { }

interface State {
    hasError: boolean;
    error?: Error;
}

export class WidgetErrorBoundary extends Component<CombinedProps, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // 1. Log to console with distinct formatting
        console.group(`Widget Crash [${this.props.widgetId}]`);
        console.error('Widget Type:', this.props.widgetType);
        console.error('Error Message:', error.message);
        console.error('Component Stack:', errorInfo.componentStack);
        console.groupEnd();

        // 2. Send to external monitoring service if available
        if (this.props.onError) {
            this.props.onError(error, errorInfo, {
                id: this.props.widgetId,
                type: this.props.widgetType
            });
        }
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: undefined });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center bg-red-50 border border-red-100 rounded-lg overflow-hidden">
                    <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                        <AlertCircle className="w-8 h-8 text-red-500 mb-2 flex-shrink-0" />
                        <h3 className="text-sm font-semibold text-red-800 mb-1 truncate max-w-full px-2">
                            {this.props.t('widgets.common.error')}
                        </h3>
                        <p className="text-xs text-red-600 mb-4 max-w-full px-4 line-clamp-3 break-words">
                            {this.state.error?.message || this.props.t('widgets.error_boundary.default_message')}
                        </p>
                        <button
                            onClick={(e) => {
                                // Prevent dragging the widget when trying to click retry
                                e.stopPropagation();
                                this.handleReset();
                            }}
                            className="flex items-center px-3 py-1.5 bg-white border border-red-200 text-red-700 rounded text-xs font-medium hover:bg-red-100 transition-colors shadow-sm flex-shrink-0 cursor-pointer"
                        >
                            <RefreshCw className="w-3 h-3 me-1.5" />
                            {this.props.t('widgets.common.retry')}
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default withTranslation()(WidgetErrorBoundary);
