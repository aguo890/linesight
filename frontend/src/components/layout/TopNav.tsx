import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Bell,
    Search,
    LogOut,
    User,
    ChevronDown
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function TopNav() {
    const { user, logout } = useAuth();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('sidebar-open');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        const handleToggle = (e: CustomEvent) => setIsSidebarOpen(e.detail.isOpen);
        window.addEventListener('sidebar-toggle', handleToggle as EventListener);
        return () => window.removeEventListener('sidebar-toggle', handleToggle as EventListener);
    }, []);

    return (
        <nav className={`h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-40 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-64' : 'ml-[70px]'}`}>
            {/* Search/Left Section */}
            <div className="flex items-center gap-4 flex-1">
                <div className="relative max-w-md w-full hidden md:block">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search factories, orders..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </div>
            </div>

            {/* Right Section: Actions & User Dropdown */}
            <div className="flex items-center gap-2 md:gap-4">
                <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                </button>

                <div className="h-8 w-px bg-slate-200 mx-1"></div>

                {/* User Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-3 p-1 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                            {user?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-slate-900 leading-tight">{user?.full_name || 'User'}</p>
                            <p className="text-xs text-slate-500 leading-tight">{user?.role || 'Viewer'}</p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <>
                            {/* Overlay to close dropdown */}
                            <div className="fixed inset-0 z-50 cursor-default" onClick={() => setIsDropdownOpen(false)}></div>

                            <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 overflow-hidden animate-in fade-in zoom-in duration-100">
                                <div className="px-4 py-3 border-b border-slate-100">
                                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.full_name}</p>
                                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                                </div>

                                <div className="p-1">
                                    {/* NEW PROFILE LINK */}
                                    <Link
                                        to="/profile"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                                    >
                                        <User className="w-4 h-4" />
                                        <span>Profile & Settings</span>
                                    </Link>

                                    {/* Optional: Add other user-specific links here */}
                                </div>

                                <div className="mt-1 pt-1 border-t border-slate-100 p-1">
                                    <button
                                        onClick={() => {
                                            setIsDropdownOpen(false);
                                            logout();
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>Sign out</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
