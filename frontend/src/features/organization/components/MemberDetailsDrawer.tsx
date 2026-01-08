import React from 'react';
import { X, Shield, Factory, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import type { MemberRead } from '../../../api/endpoints/team/teamApi';

interface MemberDetailsDrawerProps {
    member: MemberRead | null;
    isOpen: boolean;
    onClose: () => void;
    displayMode?: 'drawer' | 'modal'; // [NEW] Control render mode
    contextLines?: any[];
}

export const MemberDetailsDrawer: React.FC<MemberDetailsDrawerProps> = ({
    member,
    isOpen,
    onClose,
    displayMode = 'drawer',
    contextLines = []
}) => {
    if (!member) return null;

    const isModal = displayMode === 'modal';

    // Styles for the container (Positioning)
    const containerClasses = isModal
        ? "fixed inset-0 z-[60] flex items-center justify-center p-4" // Center screen, higher Z-index
        : "fixed inset-y-0 right-0 z-50 w-full max-w-[480px]"; // Right side with responsive max-width

    // Styles for the panel (Shape & Animation)
    const panelClasses = isModal
        ? `bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col transform transition-all duration-200 scale-100`
        : `w-full bg-white shadow-2xl h-full flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`;

    // Visibility wrapper
    const visibilityClass = isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none';

    return (
        <div className={`relative ${isModal ? 'z-[60]' : 'z-50'} ${visibilityClass}`}>

            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />

            {/* Layout Container */}
            <div className={`${containerClasses} ${!isOpen ? 'pointer-events-none' : ''}`}>
                <div className={`${panelClasses} overflow-hidden`}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/50">
                        <h2 className="text-lg font-semibold">Member Details</h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-8">

                        {/* Identity */}
                        <div className="flex flex-col items-center text-center">
                            <Avatar className="h-20 w-20 mb-4 border-4 border-gray-50">
                                <AvatarImage src={member.avatar_url || undefined} />
                                <AvatarFallback className="text-xl bg-blue-100 text-blue-700">
                                    {(member.full_name || member.email).slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <h3 className="text-xl font-bold text-gray-900">{member.full_name || 'Unknown User'}</h3>
                            <p className="text-gray-500">{member.email}</p>
                        </div>

                        {/* Section 1: Role */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Role</h4>
                            <div className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                                <Shield className="w-5 h-5 text-blue-600" />
                                <span className="capitalize font-medium text-gray-900">
                                    {member.role.replace(/_/g, ' ')}
                                </span>
                            </div>
                        </div>

                        {/* Section 2: Scopes */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Active Assignments</h4>
                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                                    {member.scopes.length}
                                </span>
                            </div>
                            {member.scopes.length === 0 ? (
                                <p className="text-sm text-gray-400 italic">No assignments.</p>
                            ) : (
                                <div className="border rounded-lg divide-y">
                                    {member.scopes.map((scope: any) => {
                                        // [NEW] LOOKUP LOGIC
                                        const knownLine = contextLines.find(l => l.id === scope.production_line_id);
                                        const displayName = knownLine ? knownLine.name : `External Line (${scope.production_line_id.slice(-4)})`;
                                        const isContextual = !!knownLine;

                                        return (
                                            <div key={scope.id} className="p-3 flex items-center justify-between bg-white">
                                                <div className="flex items-center gap-3">
                                                    <Factory className={`w-4 h-4 ${isContextual ? 'text-blue-500' : 'text-gray-400'}`} />
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-medium ${isContextual ? 'text-gray-900' : 'text-gray-500'}`}>
                                                            {displayName}
                                                        </span>
                                                        {isContextual && (
                                                            <span className="text-[10px] text-gray-400 font-mono">
                                                                {knownLine.code}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {isContextual && (
                                                    <Badge variant="outline" className="text-[10px] font-normal">
                                                        Current Factory
                                                    </Badge>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Section 3: Danger Zone */}
                        <div className="space-y-3 pt-6 border-t">
                            <h4 className="text-sm font-medium text-red-600 uppercase tracking-wider flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Danger Zone
                            </h4>
                            <Button variant="danger" className="w-full">Suspend User</Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
