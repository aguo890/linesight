import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../context/ThemeContext';
import { Logo } from '../../../components/common/Logo';
import { ArrowRight, Loader2, ShieldCheck, ChevronLeft } from 'lucide-react';

// -----------------------------------------------------------------------------
// 1. Clean, Standard Enterprise Input
// -----------------------------------------------------------------------------
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

const StandardInput: React.FC<InputProps> = ({ label, id, error, className, ...props }) => {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
            >
                {label}
            </label>
            <input
                id={id}
                {...props}
                className={`
                    w-full px-4 py-3 rounded-xl border outline-none transition-all duration-200
                    ${isDark
                        ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-600'
                        : 'bg-white border-slate-200 text-slate-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 placeholder:text-slate-400'
                    }
                    ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : ''}
                    ${className}
                `}
            />
            {error && (
                <p className="text-sm text-red-500 mt-1">{error}</p>
            )}
        </div>
    );
};

// -----------------------------------------------------------------------------
// 2. Dev Tool: Quick Access Widget (Only visible in Dev)
// -----------------------------------------------------------------------------
const DevQuickFill: React.FC<{
    setE: (v: string) => void;
    setP: (v: string) => void;
}> = ({ setE, setP }) => {
    // Only show in development
    if (!import.meta.env.DEV) return null;

    const fill = (e: string, p: string) => {
        setE(e);
        setP(p);
    };

    const sections = [
        {
            title: 'Primary Roles',
            users: [
                { label: 'Owner', role: '👑', email: 'demo@linesight.io', pw: 'demo1234', color: 'text-slate-700 dark:text-slate-200' },
                { label: 'Factory Mgr', role: '🏭', email: 'factory.manager@linesight.io', pw: 'factorymgr123', color: 'text-blue-600 dark:text-blue-400' },
                { label: 'Analyst', role: '📊', email: 'analyst@linesight.io', pw: 'analyst123', color: 'text-purple-600 dark:text-purple-400' },
                { label: 'Line Mgr', role: '⚙️', email: 'line.manager@linesight.io', pw: 'linemgr123', color: 'text-teal-600 dark:text-teal-400' },
            ]
        },
        {
            title: 'Admin & Internal',
            users: [
                { label: 'System Admin', role: '🛡️', email: 'admin@linesight.dev', pw: 'admin123', color: 'text-red-600 dark:text-red-400' },
                { label: 'Internal Staff', role: '🏢', email: 'staff@linesight.io', pw: 'staff123', color: 'text-slate-500' },
            ]
        },
        {
            title: 'Limited Access',
            users: [
                { label: 'Viewer', role: '👁️', email: 'viewer@linesight.io', pw: 'viewer123', color: 'text-amber-600 dark:text-amber-400' },
                { label: 'Guest User', role: '👤', email: 'guest@linesight.io', pw: 'guest123', color: 'text-slate-400' },
            ]
        },
        {
            title: 'Edge Cases',
            users: [
                { label: 'Long Name Test', role: '🧪', email: 'christopher.montgomery@linesight.io', pw: 'manager123', color: 'text-indigo-500' },
                { label: 'Unassigned User', role: '❓', email: 'unassigned.one@linesight.io', pw: 'manager123', color: 'text-slate-500' },
            ]
        }
    ];

    return (
        <div className="fixed bottom-4 left-4 z-50">
            <details className="group relative">
                <summary className="list-none cursor-pointer">
                    <div className="bg-slate-900 text-white text-[10px] font-mono px-3 py-1.5 rounded-full border border-slate-700 shadow-xl flex items-center gap-2 hover:bg-slate-800 transition-colors">
                        <span className="text-yellow-400">⚡</span>
                        <span className="font-bold uppercase tracking-widest">Dev Access</span>
                    </div>
                </summary>

                {/* Popover Menu - Floats Upwards */}
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[480px]">
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 shrink-0">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quick Fill Roles</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
                        {sections.map((section) => (
                            <div key={section.title} className="mb-2 last:mb-0">
                                <div className="px-3 py-1.5">
                                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-tighter">{section.title}</p>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    {section.users.map((user) => (
                                        <button
                                            key={user.email}
                                            onClick={() => fill(user.email, user.pw)}
                                            className="text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg group/item transition-colors"
                                        >
                                            <div className={`font-bold ${user.color}`}>
                                                {user.role} {user.label}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono truncate">
                                                {user.email}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 shrink-0">
                        <p className="text-[9px] text-slate-500 italic text-center">Development Mode Only</p>
                    </div>
                </div>
            </details>
        </div>
    );
};

// -----------------------------------------------------------------------------
// 3. The Login Page
// -----------------------------------------------------------------------------
const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login: authLogin, loginDemo } = useAuth();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await authLogin(email, password);
            navigate('/dashboard/factories');
        } catch (apiError: any) {
            // Simulated delay for "Premium feel" & demo fallback
            setTimeout(() => {
                if (apiError.code === 'ERR_NETWORK' || apiError.message?.includes('Network Error')) {
                    console.warn('Production API unreachable. Entering simulation mode.');
                    if (email && password) {
                        loginDemo(email);
                        navigate('/dashboard/factories');
                    } else {
                        setError('Connection error. Please try again or use demo credentials.');
                    }
                } else {
                    setError(apiError.response?.data?.detail || "Invalid credentials. Please try again.");
                }
                setLoading(false);
            }, 800);
        }
    };

    return (
        <div className={`min-h-screen w-full flex ${isDark ? 'bg-slate-950' : 'bg-white'}`}>

            {/* ----------------------------- */}
            {/* LEFT COLUMN: The Functional   */}
            {/* ----------------------------- */}
            <div className="w-full lg:w-[45%] flex flex-col justify-between p-8 lg:p-12 xl:p-16 relative z-10">

                {/* Header Logo & Back Navigation */}
                <div className="flex items-center justify-between">
                    <Logo variant="marketing" />
                    <Link
                        to="/"
                        className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <ChevronLeft size={14} /> Back to landing
                    </Link>
                </div>

                {/* Main Form Area */}
                <div className="max-w-sm w-full mx-auto">
                    <div className="mb-10">
                        <h1 className={`text-3xl font-bold tracking-tight mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Welcome back
                        </h1>
                        <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Enter your details to access the factory dashboard.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <StandardInput
                            id="email"
                            type="email"
                            label="Work Email"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            error={error ? ' ' : undefined} // Highlight border on error
                            required
                        />

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label htmlFor="password" className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    Password
                                </label>
                                <Link
                                    to="/forgot-password"
                                    className="text-sm font-semibold text-blue-600 hover:text-blue-500 transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <StandardInput
                                id="password"
                                type="password"
                                label="" // Handled above for the split layout
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                error={error ? error : undefined}
                                required
                            />
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            disabled={loading}
                            className={`
                                w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
                                ${isDark
                                    ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-xl shadow-slate-200'
                                }
                                disabled:opacity-70 disabled:cursor-not-allowed
                            `}
                        >
                            {loading ? (
                                <Loader2 className="animate-spin w-5 h-5" />
                            ) : (
                                <>
                                    Sign in <ArrowRight size={16} />
                                </>
                            )}
                        </motion.button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800 text-center">
                        <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                            Don't have an account?{' '}
                            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                                Contact Sales
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer Legal/Compliance */}
                <div className={`flex items-center gap-4 text-xs font-medium ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    {/* <span className="flex items-center gap-1.5">
                        <ShieldCheck size={14} /> SOC2 Compliant
                    </span> */}
                    {/* <span>•</span> */}
                    <a href="#" className="hover:text-slate-500">Privacy</a>
                    <span>•</span>
                    <a href="#" className="hover:text-slate-500">Terms</a>
                </div>
            </div>

            {/* ----------------------------- */}
            {/* RIGHT COLUMN: The Visual      */}
            {/* ----------------------------- */}
            <div className={`hidden lg:flex w-[55%] relative items-center justify-center overflow-hidden transition-colors duration-500 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>

                {/* Background Aesthetics */}
                <div className="absolute inset-0 z-0">
                    <div className={`absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 transition-colors duration-700 ${isDark ? 'bg-blue-600/20' : 'bg-blue-400/10'}`} />
                    <div className={`absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[100px] translate-y-1/2 -translate-x-1/3 transition-colors duration-700 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-300/10'}`} />
                    {/* Grid Pattern Overlay */}
                    <div className={`absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150 transition-opacity duration-500 ${isDark ? 'opacity-20' : 'opacity-[0.03]'}`}></div>
                </div>

                {/* The "Daily Insight" Card - Designed to look like a piece of the dashboard */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="relative z-10 w-full max-w-md px-4"
                >
                    <div className={`
                        backdrop-blur-xl border rounded-2xl p-6 shadow-2xl transition-all duration-300
                        ${isDark
                            ? 'bg-slate-800/50 border-slate-700/50 shadow-slate-950/50'
                            : 'bg-white/80 border-slate-200/60 shadow-slate-200/50'
                        }
                    `}>
                        {/* Fake Header of Card */}
                        <div className={`flex items-center justify-between mb-8 border-b pb-4 ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
                            <div>
                                <h3 className={`font-bold transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>Shift Report</h3>
                                <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Live • Factory 01</p>
                            </div>
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center animate-pulse ${isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                                <div className="h-2 w-2 rounded-full bg-current" />
                            </div>
                        </div>

                        {/* Fake Stats Row */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className={`rounded-xl p-4 border transition-colors ${isDark ? 'bg-slate-900/50 border-slate-700/30' : 'bg-slate-50 border-slate-100'}`}>
                                <p className={`text-[10px] font-bold uppercase tracking-tight mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Efficiency</p>
                                <p className={`text-2xl font-bold transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>94.2%</p>
                                <p className="text-[10px] text-emerald-500 mt-1 font-bold">↑ 2.4% vs target</p>
                            </div>
                            <div className={`rounded-xl p-4 border transition-colors ${isDark ? 'bg-slate-900/50 border-slate-700/30' : 'bg-slate-50 border-slate-100'}`}>
                                <p className={`text-[10px] font-bold uppercase tracking-tight mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Output (Units)</p>
                                <p className={`text-2xl font-bold transition-colors ${isDark ? 'text-white' : 'text-slate-900'}`}>1,240</p>
                                <p className="text-[10px] text-blue-500 mt-1 font-bold">On track</p>
                            </div>
                        </div>

                        {/* Fake Chart Visualization (CSS Lines) */}
                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                <span>Hourly Rate</span>
                                <span>Last 4h</span>
                            </div>
                            <div className={`flex items-end gap-2 h-24 pb-2 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
                                <div className={`flex-1 rounded-sm transition-all ${isDark ? 'bg-blue-500/30' : 'bg-blue-100'} h-[60%]`} />
                                <div className={`flex-1 rounded-sm transition-all ${isDark ? 'bg-blue-500/40' : 'bg-blue-200'} h-[45%]`} />
                                <div className={`flex-1 rounded-sm transition-all ${isDark ? 'bg-blue-500/50' : 'bg-blue-300'} h-[75%]`} />
                                <div className="flex-1 bg-blue-500 h-[90%] rounded-sm relative group">
                                    <div className={`absolute -top-8 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all shadow-xl ${isDark ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>
                                        Current
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Social Proof / Quote below card */}
                    <div className={`mt-8 pl-4 border-l-2 transition-colors ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                        <p className={`italic text-sm mb-2 transition-colors ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            "The visibility we gained in the first week allowed us to spot a 15% bottleneck in Line C."
                        </p>
                        <p className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            Operations Director, Textile Co.
                        </p>
                    </div>
                </motion.div>
            </div>

            {/* Dev Tool: Quick Access floating widget */}
            <DevQuickFill setE={setEmail} setP={setPassword} />
        </div>
    );
};

export default LoginPage;