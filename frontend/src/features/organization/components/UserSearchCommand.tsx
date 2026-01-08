import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import type { MemberRead } from '../../../api/endpoints/team/teamApi';
import { createPortal } from 'react-dom';

interface UserSearchCommandProps {
    users: MemberRead[];
    onSelect: (userId: string) => void;
    excludeUserIds?: string[];
    onClose: () => void;
    position?: { top: number; left: number };
}

export const UserSearchCommand: React.FC<UserSearchCommandProps> = ({
    users,
    onSelect,
    excludeUserIds = [],
    onClose,
    position
}) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Handle outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

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

    const style: React.CSSProperties = position ? {
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 50,
        maxHeight: '300px'
    } : {};

    return createPortal(
        <div
            ref={containerRef}
            className="flex flex-col w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
            style={style}
        >
            <div className="flex items-center px-3 py-2 border-b border-slate-100">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input
                    ref={inputRef}
                    className="flex-1 outline-none text-sm placeholder:text-slate-400"
                    placeholder="Search managers..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            <div className="overflow-y-auto max-h-[240px] py-1">
                {filteredUsers.length === 0 ? (
                    <div className="px-4 py-3 text-xs text-slate-500 text-center italic">
                        {query ? 'No matching managers found' : 'No available managers'}
                    </div>
                ) : (
                    filteredUsers.map(user => (
                        <button
                            key={user.id}
                            onClick={() => onSelect(user.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-indigo-50 transition-colors text-left group"
                        >
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 group-hover:bg-white group-hover:border-indigo-200">
                                <span className="text-xs font-medium text-slate-600 group-hover:text-indigo-600">
                                    {(user.full_name || user.email).charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-slate-700 truncate group-hover:text-indigo-900">
                                    {user.full_name || 'Unknown'}
                                </span>
                                <span className="text-xs text-slate-400 truncate group-hover:text-indigo-500">
                                    {user.email}
                                </span>
                            </div>
                        </button>
                    ))
                )}
            </div>

            <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 text-[10px] text-slate-400 text-right">
                {filteredUsers.length} available
            </div>
        </div>,
        document.body
    );
};
