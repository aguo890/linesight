import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Bell,
    Search,
    LogOut,
    User,
    ChevronDown
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';

export default function TopNav() {
    const { t } = useTranslation();
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
        <nav className={`h-16 bg-surface border-b border-border flex items-center justify-between px-4 sticky top-0 z-40 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'ms-64' : 'ms-[70px]'}`}>
            {/* Search/Left Section */}
            <div className="flex items-center gap-4 flex-1">
                <div className="relative max-w-md w-full hidden md:block">
                    <Search className="w-4 h-4 text-text-muted absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && searchQuery.trim()) {
                                setShowSearchToast(true);
                            }
                        }}
                        placeholder={t('layout.top_nav.search_placeholder')}
                        className="w-full ps-10 pe-4 py-2 bg-surface-subtle border border-border rounded-lg text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
                    />
                    {/* Toast Notification */}
                    {showSearchToast && (
                        <div className="absolute top-full start-0 mt-2 px-4 py-2 bg-surface-elevated text-text-main text-sm rounded-lg shadow-lg border border-border flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <span>{t('layout.top_nav.search_coming_soon')}</span>
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
                        className={`p-2 rounded-lg transition-colors relative ${isNotificationsOpen ? 'bg-brand/10 text-brand' : 'text-text-muted hover:bg-surface-subtle'}`}
                    >
                        <Bell className="w-5 h-5" />
                        {notifications.length > 0 && (
                            <span className="absolute top-2 end-2 w-2 h-2 bg-danger rounded-full border-2 border-surface"></span>
                        )}
                    </button>

                    {/* Notification Panel */}
                    {isNotificationsOpen && (
                        <>
                            <div className="fixed inset-0 z-50 cursor-default" onClick={() => setIsNotificationsOpen(false)}></div>
                            <div className="absolute end-0 mt-2 w-80 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in duration-100">
                                <div className="px-4 py-3 border-b border-border-subtle flex justify-between items-center">
                                    <h3 className="text-sm font-semibold text-text-main">{t('layout.top_nav.notifications.title')}</h3>
                                    {notifications.length > 0 && (
                                        <button className="text-xs text-brand hover:text-brand-dark font-medium">{t('layout.top_nav.notifications.mark_read')}</button>
                                    )}
                                </div>

                                <div className="max-h-[300px] overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="px-4 py-8 text-center text-text-muted">
                                            <Bell className="w-8 h-8 mx-auto mb-2 text-text-subtle" />
                                            <p className="text-sm">{t('layout.top_nav.notifications.empty')}</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-border-subtle">
                                            {/* Map mock notifications here later */}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="h-8 w-px bg-border mx-1"></div>

                {/* User Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-3 p-1 hover:bg-surface-subtle rounded-lg transition-colors"
                    >
                        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold">
                            {user?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-sm font-medium text-text-main leading-tight">{user?.full_name || t('layout.top_nav.user_menu.default_user')}</p>
                            <p className="text-xs text-text-muted leading-tight">{user?.role || t('layout.top_nav.user_menu.default_role')}</p>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                        <>
                            {/* Overlay to close dropdown */}
                            <div className="fixed inset-0 z-50 cursor-default" onClick={() => setIsDropdownOpen(false)}></div>

                            <div className="absolute end-0 mt-2 w-56 bg-surface border border-border rounded-xl shadow-xl z-50 py-2 overflow-hidden animate-in fade-in zoom-in duration-100">
                                <div className="px-4 py-3 border-b border-border-subtle">
                                    <p className="text-sm font-semibold text-text-main truncate">{user?.full_name}</p>
                                    <p className="text-xs text-text-muted truncate">{user?.email}</p>
                                </div>

                                <div className="p-1">
                                    {/* NEW PROFILE LINK */}
                                    <Link
                                        to="/profile"
                                        onClick={() => setIsDropdownOpen(false)}
                                        className="flex items-center gap-3 px-3 py-2 text-sm text-text-main hover:bg-brand/10 hover:text-brand rounded-lg transition-colors"
                                    >
                                        <User className="w-4 h-4" />
                                        <span>{t('layout.top_nav.user_menu.profile')}</span>
                                    </Link>

                                    {/* Optional: Add other user-specific links here */}
                                </div>

                                <div className="mt-1 pt-1 border-t border-border-subtle p-1">
                                    <button
                                        onClick={() => {
                                            setIsDropdownOpen(false);
                                            logout();
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span>{t('layout.top_nav.user_menu.logout')}</span>
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
