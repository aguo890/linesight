import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Globe, Save, Loader2, Bell, Shield, Smartphone, ArrowLeft, Building2, Factory } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { type UserPreferences } from '../../lib/authApi';
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

export default function ProfilePage() {
    const { user, updateUser } = useAuth();
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
        theme: 'light'
    });

    // Calculate if form is dirty (has changes)
    const isDirty = user ? (
        formData.full_name !== (user.full_name || '') ||
        formData.timezone !== (user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone) ||
        formData.country_code !== (getPrefs(user).country_code || '') ||
        formData.theme !== (getPrefs(user).theme || 'light')
    ) : false;

    // Initialize form from user data
    useEffect(() => {
        if (user) {
            const prefs = getPrefs(user);
            setFormData({
                full_name: user.full_name || '',
                timezone: user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                country_code: prefs.country_code || '',
                theme: (prefs.theme as string) || 'light'
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

    const handleSave = async () => {
        if (!user) return;
        if (!formData.full_name.trim()) {
            setErrorMessage('Full name is required');
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
                theme: formData.theme as 'light' | 'dark' | 'system'
            };

            await updateUser({
                full_name: formData.full_name,
                timezone: formData.timezone,
                preferences: newPrefs
            });

            setSuccessMessage('Profile updated successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error("Failed to update profile", error);
            setErrorMessage('Failed to update profile. Please try again.');
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
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors group"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                Back
            </button>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">User Profile</h1>
                    <p className="text-slate-500">Manage your account settings and preferences</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isLoading || !isDirty}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>

            {successMessage && (
                <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg text-sm border border-emerald-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    {successMessage}
                </div>
            )}

            {errorMessage && (
                <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm border border-red-100 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    {errorMessage}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Left Column: Avatar & Basic Info */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center">
                        <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center mb-4 text-indigo-600 text-2xl font-bold border-4 border-indigo-50">
                            {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </div>
                        <h2 className="font-semibold text-slate-900">{user.full_name || 'User'}</h2>
                        <p className="text-sm text-slate-500">{user.email}</p>

                        {/* Organizational Context Badge */}
                        {organization && (
                            <div className="mt-3 space-y-1">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-100">
                                    <Building2 className="w-3.5 h-3.5" />
                                    <span className="capitalize">{user.role}</span>
                                    <span className="text-indigo-400">at</span>
                                    <span className="font-semibold">{organization.name}</span>
                                </div>
                            </div>
                        )}

                        {!organization && (
                            <div className="mt-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                {user.role}
                            </div>
                        )}
                    </div>

                    {/* Factory Associations */}
                    {factories.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                                    <Factory className="w-4 h-4 text-indigo-600" />
                                    Your Factories
                                </h3>
                            </div>
                            <div className="p-3 space-y-1">
                                {factories.map(factory => (
                                    <div
                                        key={factory.id}
                                        className="px-3 py-2 text-sm text-slate-700 bg-slate-50 rounded-lg flex items-center gap-2"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        {factory.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-sm font-medium text-slate-900">Security</h3>
                        </div>
                        <div className="p-2">
                            <button className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                                <Shield className="w-4 h-4 text-slate-400" />
                                <span>Change Password</span>
                            </button>
                            <button className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors">
                                <Smartphone className="w-4 h-4 text-slate-400" />
                                <span>Two-Factor Auth</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Settings Forms */}
                <div className="md:col-span-2 space-y-6">

                    {/* Personal Information */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-6 text-slate-900 font-medium pb-4 border-b border-slate-100">
                            <User className="w-4 h-4 text-indigo-600" />
                            Personal Information
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        value={user.email}
                                        disabled
                                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-500"
                                    />
                                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                </div>
                                <p className="mt-1 text-xs text-slate-400">Email cannot be changed directly.</p>
                            </div>
                        </div>
                    </div>

                    {/* Localization */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-center gap-2 mb-6 text-slate-900 font-medium pb-4 border-b border-slate-100">
                            <Globe className="w-4 h-4 text-indigo-600" />
                            Localization & Region
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
                                    <select className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none">
                                        <option value="en-US">English (US)</option>
                                        <option value="es">Spanish</option>
                                        <option value="ar">Arabic</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Theme</label>
                                    <select
                                        value={formData.theme}
                                        onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                                    >
                                        <option value="light">Light Mode</option>
                                        <option value="dark">Dark Mode</option>
                                        <option value="system">System Default</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notifications (Placeholder) */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 opacity-60">
                        <div className="flex items-center gap-2 mb-6 text-slate-900 font-medium pb-4 border-b border-slate-100">
                            <Bell className="w-4 h-4 text-indigo-600" />
                            Notification Preferences (Coming Soon)
                        </div>
                        <div className="space-y-3">
                            {['Email Alerts', 'Push Notifications', 'Weekly Digest'].map(item => (
                                <div key={item} className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">{item}</span>
                                    <div className="w-10 h-6 bg-slate-200 rounded-full relative">
                                        <div className="w-4 h-4 bg-white rounded-full absolute top-1 left-1 shadow-sm"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
