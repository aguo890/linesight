import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { MemberRead } from '../../../api/endpoints/team/teamApi';
import { createPortal } from 'react-dom';

interface UserSearchCommandProps {
    users: MemberRead[];
    onSelect: (userId: string) => void;
    excludeUserIds?: string[];
    onClose: () => void;
    position?: { top: number; left: number };
    inline?: boolean;
}

export const UserSearchCommand: React.FC<UserSearchCommandProps> = ({
    users,
    onSelect,
    excludeUserIds = [],
    onClose,
    position,
    inline
}) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Handle outside click
    useEffect(() => {
        if (inline) return; // Don't handle outside click if inline (parent Popover handles it)

        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose?.();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose, inline]);

    const filteredUsers = useMemo(() => {
        return users
            .filter(u => !excludeUserIds.includes(u.id))
            .filter(u => {
                if (!query) return true;
                const searchStr = query.toLowerCase();
                return (
                    (u.full_name?.toLowerCase().includes(searchStr)) ||
                    (u.email.toLowerCase().includes(searchStr))
                );
            });
    }, [users, excludeUserIds, query]);

    const style: React.CSSProperties = (position && !inline) ? {
        position: 'fixed',
        top: position.top,
        insetInlineStart: position.left,
        zIndex: 50,
        maxHeight: '300px'
    } : {};

    const content = (
        <div
            ref={containerRef}
            className={cn(
                "flex flex-col bg-white dark:bg-slate-800 rounded-lg overflow-hidden",
                !inline && "w-72 shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-100",
                inline && "w-full border-0 shadow-none bg-transparent dark:bg-transparent"
            )}
            style={style}
        >
            <div className="flex items-center px-3 py-2 border-b border-slate-100 dark:border-slate-700">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 me-2" />
                <input
                    ref={inputRef}
                    className="flex-1 outline-none text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 bg-transparent text-slate-900 dark:text-slate-100"
                    placeholder={t('data_source_list.user_search.placeholder')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            <div className="overflow-y-auto max-h-[240px] py-1">
                {filteredUsers.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 text-center italic">
                        {query ? t('data_source_list.user_search.no_results') : t('data_source_list.user_search.no_available')}
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <button
                            key={user.id}
                            onClick={() => onSelect(user.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors text-start group"
                        >
                            <div className="w-8 h-8 shrink-0 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center ring-2 ring-white dark:ring-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:ring-indigo-100 dark:group-hover:ring-slate-800">
                                <span className="text-xs font-medium text-slate-600 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
                                    {(user.full_name || user.email).charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-900 dark:group-hover:text-indigo-100">
                                    {user.full_name || t('common.status.unknown')}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-slate-500 truncate group-hover:text-indigo-500 dark:group-hover:text-indigo-300">
                                    {user.email}
                                </span>
                            </div>
                        </button>
                    ))
                )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-2 border-t border-slate-100 dark:border-slate-700 text-[10px] text-slate-400 dark:text-slate-500 text-end">
                {t('data_source_list.user_search.available_count', { count: filteredUsers.length })}
            </div>
        </div>
    );

    if (inline) {
        return content;
    }

    return createPortal(content, document.body);
};
