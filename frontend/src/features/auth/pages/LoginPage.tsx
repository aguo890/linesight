import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../../hooks/useAuth';
import { Logo } from '../../../components/common/Logo';
import { Eye, EyeOff, Lock, Mail, ShieldCheck, Activity, ChevronRight } from 'lucide-react';

// -----------------------------------------------------------------------------
// 1. Reusable "Floating Label" Input with Integrated Icons
// -----------------------------------------------------------------------------
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    id: string;
    icon: React.ElementType;
    error?: boolean;
    rightElement?: React.ReactNode;
}

const FloatingInput: React.FC<InputProps> = ({ label, id, icon: Icon, error, rightElement, className, ...props }) => {
    return (
        <div className="relative group">
            <div className={`
                absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 z-10
                ${error ? 'text-red-400' : 'text-slate-400 group-focus-within:text-blue-500'}
            `}>
                <Icon size={18} />
            </div>

            <input
                id={id}
                {...props}
                placeholder=" "
                className={`
                    peer w-full pl-12 pr-4 pt-6 pb-2 rounded-2xl border-2 bg-white/40 
                    outline-none transition-all duration-300 ease-out backdrop-blur-sm
                    focus:bg-white/80 focus:border-blue-500/50 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)]
                    ${error ? 'border-red-400/50 bg-red-50/30' : 'border-transparent'}
                    ${className}
                `}
            />

            <label
                htmlFor={id}
                className={`
                    absolute left-12 top-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 
                    pointer-events-none transition-all duration-300
                    peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal
                    peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-[0.15em]
                    ${error ? 'text-red-500' : 'peer-focus:text-blue-500'}
                `}
            >
                {label}
            </label>

            {rightElement && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                    {rightElement}
                </div>
            )}
        </div>
    );
};

// -----------------------------------------------------------------------------
// 2. Main Login Page
// -----------------------------------------------------------------------------
const LoginPage: React.FC = () => {
    // Logic State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login: authLogin, loginDemo } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await authLogin(email, password);
            navigate('/dashboard');
        } catch (apiError: any) {
            // Logic preservation: Fallback to demo mode if backend is unreachable
            if (apiError.code === 'ERR_NETWORK' || apiError.message?.includes('Network Error')) {
                console.warn('Production API unreachable. Entering simulation mode.');
                if (email && password) {
                    loginDemo(email);
                    navigate('/dashboard');
                } else {
                    setError('Verification Required');
                }
            } else {
                setError(apiError.response?.data?.detail || 'Invalid Credentials');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F5F5F7] relative overflow-hidden font-sans text-slate-900">

            {/* Animated Background Mesh */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent animate-[spin_120s_linear_infinite]" />
                <div className="absolute top-[10%] right-[10%] w-96 h-96 bg-blue-200/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-[10%] left-[10%] w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            {/* Main Interface Object */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="w-full max-w-[440px] p-1 relative z-10"
            >
                {/* Liquid Glass Container */}
                <div className="absolute inset-0 bg-white/70 backdrop-blur-3xl backdrop-saturate-150 rounded-[40px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] border border-white/60" />

                <div className="relative z-20 p-10 flex flex-col">
                    {/* Header Section */}
                    <header className="flex flex-col items-center mb-10">
                        <motion.div
                            initial={{ transform: 'scale(0.8)' }}
                            animate={{ transform: 'scale(1)' }}
                            className="mb-6"
                        >
                            <Logo variant="auth" stacked />
                        </motion.div>

                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100/50 border border-slate-200/50 mb-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Operational</span>
                        </div>

                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Operator Login</h1>
                        <p className="text-slate-500 text-sm mt-1">Authorized access only</p>
                    </header>

                    {/* Login Form with Shake Physics */}
                    <motion.form
                        onSubmit={handleSubmit}
                        animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        className="space-y-4"
                    >
                        <FloatingInput
                            id="email"
                            type="email"
                            label="Operator ID"
                            icon={Mail}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            error={!!error}
                            required
                        />

                        <FloatingInput
                            id="password"
                            type={showPassword ? "text" : "password"}
                            label="Access Key"
                            icon={Lock}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={!!error}
                            required
                            rightElement={
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            }
                        />

                        {error && (
                            <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="text-center text-xs font-bold text-red-500 uppercase tracking-wider"
                            >
                                {error}
                            </motion.p>
                        )}

                        <motion.button
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            disabled={loading}
                            className="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold text-sm tracking-widest uppercase shadow-xl shadow-slate-900/20 flex items-center justify-center gap-3 mt-6 group transition-all disabled:opacity-70"
                        >
                            {loading ? (
                                <Activity className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <span>Initialize Session</span>
                                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                </>
                            )}
                        </motion.button>
                    </motion.form>

                    {/* Tactical Demo Bypass */}
                    <div className="mt-10 pt-8 border-t border-slate-200/50 space-y-3">
                        <div className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
                            Quick Login As
                        </div>

                        {/* Demo Users Dropdown */}
                        <select
                            onChange={(e) => {
                                const [email, pwd] = e.target.value.split('|');
                                if (email && pwd) {
                                    setEmail(email);
                                    setPassword(pwd);
                                }
                            }}
                            defaultValue=""
                            className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white/50 text-slate-600 text-sm font-medium hover:border-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none cursor-pointer"
                        >
                            <option value="" disabled>Select a demo user...</option>

                            <optgroup label="👑 System Admin">
                                <option value="admin@linesight.dev|admin123">admin@linesight.dev</option>
                            </optgroup>

                            <optgroup label="🏢 Owner">
                                <option value="demo@linesight.io|demo1234">demo@linesight.io (Demo Org Owner)</option>
                            </optgroup>

                            <optgroup label="📊 Standard Managers">
                                <option value="emily.chen@linesight.io|manager123">Emily Chen (logged in 2h ago)</option>
                                <option value="marcus.johnson@linesight.io|manager123">Marcus Johnson (logged in 1d ago)</option>
                                <option value="sofia.rodriguez@linesight.io|manager123">Sofia Rodriguez (logged in 3d ago)</option>
                                <option value="james.williams@linesight.io|manager123">James Williams (logged in 7d ago)</option>
                                <option value="aisha.patel@linesight.io|manager123">Aisha Patel (logged in 14d ago)</option>
                            </optgroup>

                            <optgroup label="🧪 Edge Cases">
                                <option value="christopher.montgomery@linesight.io|manager123">🔤 UI Breaker (very long name)</option>
                                <option value="ghost.user@linesight.io|manager123">👻 Ghost (never logged in, no avatar)</option>
                                <option value="stale.user@linesight.io|manager123">⏰ Stale User (90+ days inactive)</option>
                                <option value="suspended.user@linesight.io|manager123">🚫 Suspended User (is_active=false)</option>
                            </optgroup>

                            <optgroup label="⚡ Super Manager">
                                <option value="super.manager@linesight.io|manager123">Super Manager (ALL lines)</option>
                            </optgroup>

                            <optgroup label="🚫 Unassigned (no lines)">
                                <option value="unassigned.one@linesight.io|manager123">Unassigned Manager One</option>
                                <option value="unassigned.two@linesight.io|manager123">Unassigned Manager Two</option>
                            </optgroup>

                            <optgroup label="🏭 Cross-Factory">
                                <option value="cross.factory@linesight.io|manager123">Cross-Factory Manager (Detroit + Shanghai)</option>
                            </optgroup>

                            <optgroup label="🔧 Chassis Line (Overcrowded)">
                                <option value="chassis.lead@linesight.io|manager123">Chassis Lead</option>
                                <option value="chassis.assistant@linesight.io|manager123">Chassis Assistant</option>
                                <option value="chassis.supervisor@linesight.io|manager123">Chassis Supervisor</option>
                            </optgroup>
                        </select>

                        <div className="text-center pt-2">
                            <Link to="/register" className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                                Request Access Credentials
                            </Link>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Tactical Footer */}
            <div className="absolute bottom-8 w-full px-10 flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] opacity-60">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={12} />
                    AES-256 Encrypted
                </div>
                <div>Node: North_America_v3.0</div>
            </div>
        </div>
    );
};

export default LoginPage;