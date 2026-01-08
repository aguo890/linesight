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
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [showSearchToast, setShowSearchToast] = useState(false);

    // MOCK DATA: Notifications (Empty for now to show empty state)
    const notifications: any[] = [];
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        const saved = localStorage.getItem('sidebar-open');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        const handleToggle = (e: CustomEvent) => setIsSidebarOpen(e.detail.isOpen);
        window.addEventListener('sidebar-toggle', handleToggle as EventListener);
        return () => window.removeEventListener('sidebar-toggle', handleToggle as EventListener);
    }, []);

    useEffect(() => {
        if (showSearchToast) {
            const timer = setTimeout(() => setShowSearchToast(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showSearchToast]);

    return (
        <nav className={`h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-40 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ml-64' : 'ml-[70px]'}`}>
            {/* Search/Left Section */}
            <div className="flex items-center gap-4 flex-1">
                <div className="relative max-w-md w-full hidden md:block">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && searchQuery.trim()) {
                                setShowSearchToast(true);
                            }
                        }}
                        placeholder="Search factories, orders..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                    {/* Toast Notification */}
                    {showSearchToast && (
                        <div className="absolute top-full left-0 mt-2 px-4 py-2 bg-slate-800 text-white text-sm rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <span>Global search is coming soon!</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Section: Actions & User Dropdown */}
            <div className="flex items-center gap-2 md:gap-4">
                {/* Notifications Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => {
                            setIsNotificationsOpen(!isNotificationsOpen);
                            setIsDropdownOpen(false);
                        }}
                        className={`p-2 rounded-lg transition-colors relative ${isNotificationsOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Bell className="w-5 h-5" />
                        {notifications.length > 0 && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
                        )}
                    </button>

                    {/* Notification Panel */}
                    {isNotificationsOpen && (
                        <>
                            <div className="fixed inset-0 z-50 cursor-default" onClick={() => setIsNotificationsOpen(false)}></div>
                            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-100">
                                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                                    {notifications.length > 0 && (
                                        <button className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Mark all read</button>
                                    )}
                                </div>

                                <div className="max-h-[300px] overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-slate-500">
                                            <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                            <p className="text-sm">No new notifications</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {/* Map mock notifications here later */}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

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
