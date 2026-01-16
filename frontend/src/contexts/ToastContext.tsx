import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ToastContainer } from '../components/ui/ToastContainer';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: number;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
        const id = Date.now(); // Simple ID generation

        // Error toasts persist by default (duration = 0), others auto-dismiss after 3 seconds
        const effectiveDuration = duration ?? (type === 'error' ? 0 : 3000);

        setToasts((prev) => [...prev, { id, message, type, duration: effectiveDuration }]);

        if (effectiveDuration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, effectiveDuration);
        }
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
