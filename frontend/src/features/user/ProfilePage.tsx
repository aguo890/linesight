import { useState, useEffect } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { User, Mail, Globe, Save, Loader2, Bell, Shield, Smartphone, ArrowLeft, Building2, Factory } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { type UserPreferences, type UserInfo } from '../../lib/authApi';
import LocationSelector from '../../features/dashboard/components/LocationSelector';
import { getPrefs } from './utils';
import api from '../../lib/api';
import { listFactories } from '../../lib/factoryApi';

// Organization type for display
interface OrgInfo {
    id: string;
    name: string;
    code?: string;
    subscription_tier: string;
}

interface FactoryInfo {
    id: string;
    name: string;
}

import { toRegionLocale, detectBestLocale } from '../../utils/localeUtils';
import { LanguageSelector } from '../../components/common/LanguageSelector';
import { AutoFlipIcon } from '../../components/common/AutoFlipIcon';

// Helper to get normalized locale (Legacy 'en' -> 'en-US')
const getNormalizedLocale = (u: UserInfo | null) => {
    const rawLocale = getPrefs(u).locale;
    return toRegionLocale(rawLocale || detectBestLocale());
};

export default function ProfilePage() {
    const { t } = useTranslation();
    const { user, updateUser } = useAuth();
    const { setTheme, systemTheme } = useTheme();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Organization and factory context
    const [organization, setOrganization] = useState<OrgInfo | null>(null);
    const [factories, setFactories] = useState<FactoryInfo[]>([]);

    // Local state for form
    const [formData, setFormData] = useState({
        full_name: '',
        timezone: '',
        country_code: '',
        theme: 'system' as 'light' | 'dark' | 'system',
        locale: ''
    });

    // Calculate if form is dirty (has changes)
    const isDirty = user ? (
        formData.full_name !== (user.full_name || '') ||
        formData.timezone !== (user.timezone || 'UTC') ||
        formData.country_code !== (getPrefs(user).country_code || '') ||
        formData.theme !== (getPrefs(user).theme || 'system') ||
        formData.locale !== getNormalizedLocale(user)
    ) : false;

    // Initialize form from user data
    useEffect(() => {
        if (user) {
            const prefs = getPrefs(user);
            setFormData({
                full_name: user.full_name || '',
                timezone: user.timezone || 'UTC',
                country_code: prefs.country_code || '',
                theme: (prefs.theme as 'light' | 'dark' | 'system') || 'system',
                locale: getNormalizedLocale(user)
            });
        }
    }, [user]);

    // Fetch organization and factory context
    useEffect(() => {
        const fetchOrgContext = async () => {
            try {
                // Fetch organization details
                const orgResponse = await api.get('/organizations/me');
                setOrganization(orgResponse.data);

                // Fetch factories for this user's organization
                const factoryList = await listFactories();
                setFactories(factoryList.map(f => ({ id: f.id, name: f.name })));
            } catch (error) {
                console.error('Failed to load organization context', error);
            }
        };

        if (user) {
            fetchOrgContext();
        }
    }, [user]);

    // Prevent navigation if dirty
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            isDirty && currentLocation.pathname !== nextLocation.pathname
    );

    // Handle window close/reload
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const handleSave = async () => {
        if (!user) return;
        if (!formData.full_name.trim()) {
            setErrorMessage(t('profile.error_required'));
            return;
        }

        setIsLoading(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            const currentPrefs = getPrefs(user);

            const newPrefs: UserPreferences = {
                ...currentPrefs,
                country_code: formData.country_code,
                theme: formData.theme as 'light' | 'dark' | 'system',
                locale: formData.locale
            };

            await updateUser({
                full_name: formData.full_name,
                timezone: formData.timezone,
                preferences: newPrefs
            });

            // IMMEDIATE UI UPDATE: Sync theme to context
            setTheme(formData.theme as 'light' | 'dark' | 'system');

            setSuccessMessage(t('profile.success'));
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error("Failed to update profile", error);
            setErrorMessage(t('profile.error_fail'));
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">

            {/* Back Button */}
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-sm text-text-muted hover:text-text-main transition-colors group"
            >
                <AutoFlipIcon
                    icon={ArrowLeft}
                    className="w-4 h-4 group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
                />
                {t('profile.back')}
            </button>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-text-main">{t('profile.title')}</h1>
                    <p className="text-text-muted">{t('profile.subtitle')}</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isLoading || !isDirty}
                    className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t('profile.save_btn')}
                </button>
            </div>

            {successMessage && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-lg text-sm border border-emerald-100 dark:border-emerald-800 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    {successMessage}
                </div>
            )}

            {errorMessage && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm border border-red-100 dark:border-red-800 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    {errorMessage}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Column: Avatar & Basic Info */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-surface rounded-xl border border-border shadow-sm p-6 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full bg-brand/10 flex items-center justify-center mb-4 text-brand text-2xl font-bold border-4 border-brand/5">
                            {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </div>
                        <h2 className="font-semibold text-text-main">{user.full_name || 'User'}</h2>
                        <p className="text-sm text-text-muted">{user.email}</p>

                        {/* Organizational Context Badge */}
                        {organization && (
                            <div className="mt-3 space-y-1">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-brand/10 to-purple-500/10 text-brand border border-brand/20">
                                    <Building2 className="w-3.5 h-3.5" />
                                    <span className="capitalize">{user.role}</span>
                                    <span className="text-brand/60">{t('profile.at')}</span>
                                    <span className="font-semibold">{organization.name}</span>
                                </div>
                            </div>
                        )}

                        {!organization && (
                            <div className="mt-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-subtle text-text-main">
                                {user.role}
                            </div>
                        )}
                    </div>

                    {/* Factory Associations */}
                    {factories.length > 0 && (
                        <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-border-subtle bg-surface-subtle">
                                <h3 className="text-sm font-medium text-text-main flex items-center gap-2">
                                    <Factory className="w-4 h-4 text-brand" />
                                    {t('profile.sections.factories')}
                                </h3>
                            </div>
                            <div className="p-3 space-y-1">
                                {factories.map(factory => (
                                    <div
                                        key={factory.id}
                                        className="px-3 py-2 text-sm text-text-main bg-surface-subtle rounded-lg flex items-center gap-2"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        {factory.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border-subtle bg-surface-subtle">
                            <h3 className="text-sm font-medium text-text-main">{t('profile.sections.security')}</h3>
                        </div>
                        <div className="p-2">
                            <button className="w-full text-start px-4 py-3 text-sm text-text-main hover:bg-surface-subtle flex items-center gap-3 transition-colors rounded-lg">
                                <Shield className="w-4 h-4 text-text-muted" />
                                <span>{t('profile.security.change_password')}</span>
                            </button>
                            <button className="w-full text-start px-4 py-3 text-sm text-text-main hover:bg-surface-subtle flex items-center gap-3 transition-colors rounded-lg">
                                <Smartphone className="w-4 h-4 text-text-muted" />
                                <span>{t('profile.security.two_factor')}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Settings Forms */}
                <div className="md:col-span-2 space-y-6">

                    {/* Personal Information */}
                    <div className="bg-surface rounded-xl border border-border shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-6 text-text-main font-medium pb-4 border-b border-border-subtle">
                            <User className="w-4 h-4 text-brand" />
                            {t('profile.sections.personal_info')}
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-main mb-1">{t('profile.fields.full_name')}</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    dir="auto"
                                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-main mb-1">{t('profile.fields.email')}</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={user.email}
                                        disabled
                                        dir="ltr"
                                        className="w-full ps-9 pe-3 py-2 bg-surface-subtle border border-border rounded-lg text-sm text-text-muted text-left"
                                    />
                                    <Mail className="w-4 h-4 text-text-muted absolute start-3 top-2.5" />
                                </div>
                                <p className="mt-1 text-xs text-text-subtle">{t('profile.fields.email_hint')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Localization */}
                    <div className="bg-surface rounded-xl border border-border shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-6 text-text-main font-medium pb-4 border-b border-border-subtle">
                            <Globe className="w-4 h-4 text-brand" />
                            {t('profile.sections.localization')}
                        </div>

                        <div className="space-y-6">
                            <LocationSelector
                                countryCode={formData.country_code}
                                timezone={formData.timezone}
                                onChange={(val) => {
                                    setFormData({
                                        ...formData,
                                        country_code: val.countryCode,
                                        timezone: val.timezone
                                    });
                                }}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-main mb-1">{t('profile.fields.language')}</label>
                                    <LanguageSelector
                                        value={formData.locale}
                                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                        onPreferenceChange={(key, value) => {
                                            setFormData(prev => ({ ...prev, [key]: value }));
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-main mb-1">{t('profile.fields.theme')}</label>
                                    <select
                                        value={formData.theme}
                                        onChange={(e) => setFormData({ ...formData, theme: e.target.value as 'light' | 'dark' | 'system' })}
                                        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-main focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                                    >
                                        <option value="light">{t('profile.themes.light')}</option>
                                        <option value="dark">{t('profile.themes.dark')}</option>
                                        <option value="system">
                                            {t('profile.themes.system')} ({systemTheme === 'dark' ? t('profile.themes.dark') : t('profile.themes.light')})
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notifications (Placeholder) */}
                    <div className="bg-surface rounded-xl border border-border shadow-sm p-6 opacity-60">
                        <div className="flex items-center gap-2 mb-6 text-text-main font-medium pb-4 border-b border-border-subtle">
                            <Bell className="w-4 h-4 text-brand" />
                            {t('profile.sections.notifications')}
                        </div>
                        <div className="space-y-3">
                            {['Email Alerts', 'Push Notifications', 'Weekly Digest'].map(item => (
                                <div key={item} className="flex items-center justify-between">
                                    <span className="text-sm text-text-muted">{item}</span>
                                    <div className="w-10 h-6 bg-surface-subtle rounded-full relative border border-border">
                                        <div className="w-4 h-4 bg-surface rounded-full absolute top-1 start-1 shadow-sm"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>


            <ConfirmDialog
                isOpen={blocker.state === "blocked"}
                title={t('profile.unsaved_changes.title')}
                message={t('profile.unsaved_changes.message')}
                confirmLabel={t('profile.unsaved_changes.confirm')}
                cancelLabel={t('profile.unsaved_changes.cancel')}
                onConfirm={() => blocker.proceed?.()}
                onClose={() => blocker.reset?.()}
                variant="warning"
            />
        </div >
    );
}
