import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface MemberIdentityCellProps {
    member: {
        full_name?: string;
        email: string;
        avatar_url?: string;
        is_active?: boolean;
    };
}

export const MemberIdentityCell: React.FC<MemberIdentityCellProps> = ({ member }) => {
    const name = member.full_name || 'Unknown User';
    const email = member.email;
    const initials = name.slice(0, 2).toUpperCase();
    const isActive = member.is_active ?? true; // Default to true if undefined for now

    return (
        <div className="flex items-center gap-3">
            <div className="relative">
                <Avatar className="h-9 w-9 border border-gray-200">
                    <AvatarImage src={member.avatar_url} alt={name} />
                    <AvatarFallback className="bg-blue-50 text-blue-700 text-xs font-medium">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <span
                    className={`absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-800 ${isActive ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    title={isActive ? "Active" : "Inactive"}
                />
            </div>
            <div className="flex flex-col max-w-[180px]">
                <span className="text-sm font-medium text-gray-900 truncate dark:text-white" title={name}>
                    {name}
                </span>
                <span className="text-xs text-gray-500 truncate dark:text-gray-400" title={email}>
                    {email}
                </span>
            </div>
        </div>
    );
};
