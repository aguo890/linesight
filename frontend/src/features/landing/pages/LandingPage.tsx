import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../../hooks/useAuth';
import { Logo } from '../../../components/common/Logo';
import {
    ArrowRight,
    LayoutDashboard,
    BarChart3,
    Check,
    Zap
} from 'lucide-react';
import { MockSpeedQualityWidget } from '../components/simulation/MockSpeedQualityWidget';
import { MockTargetRealizationWidget } from '../components/simulation/MockTargetRealizationWidget';
import { MockBlockerCloudWidget } from '../components/simulation/MockBlockerCloudWidget';
import { MiniDashboard } from '../components/simulation/MiniDashboard';

const springTransition = { type: "spring", stiffness: 100, damping: 20 } as const;

const fadeInVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
} as const;

// --- Sub-components for "Next Level" Polish ---

const DEMO_SPEED_QUALITY = [
    { date: 'Mon', efficiency_pct: 82, defects_per_hundred: 2.1 },
    { date: 'Tue', efficiency_pct: 88, defects_per_hundred: 1.5 },
    { date: 'Wed', efficiency_pct: 94, defects_per_hundred: 0.8 },
    { date: 'Thu', efficiency_pct: 91, defects_per_hundred: 1.2 },
    { date: 'Fri', efficiency_pct: 85, defects_per_hundred: 2.5 },
    { date: 'Sat', efficiency_pct: 96, defects_per_hundred: 0.5 },
    { date: 'Sun', efficiency_pct: 89, defects_per_hundred: 1.1 },
];

const DEMO_TARGET = {
    day: 'Today',
    actual: 1245,
    target: 1400
};

const DEMO_BLOCKERS = [
    { reason: 'Material Starved', count: 12 },
    { reason: 'Needle Breakage', count: 8 },
    { reason: 'Unplanned Maint', count: 5 },
];

const DEMO_EFFICIENCY = { efficiency: 94.2, target: 85 };
const DEMO_EARNED_MINUTES = {
    earned_minutes: 42150,
    total_available_minutes: 45000,
    efficiency_pct_aggregate: 93.6,
    breakdown: [
        { time: '08:00', earnedMinutes: 4500, availableMinutes: 5000, efficiency: 90 },
        { time: '09:00', earnedMinutes: 9200, availableMinutes: 10000, efficiency: 92 },
        { time: '10:00', earnedMinutes: 14000, availableMinutes: 15000, efficiency: 93 },
        { time: '11:00', earnedMinutes: 19000, availableMinutes: 20000, efficiency: 95 },
        { time: '12:00', earnedMinutes: 23500, availableMinutes: 25000, efficiency: 94 },
        { time: '13:00', earnedMinutes: 28000, availableMinutes: 30000, efficiency: 93 },
        { time: '14:00', earnedMinutes: 33000, availableMinutes: 35000, efficiency: 94 },
        { time: '15:00', earnedMinutes: 38000, availableMinutes: 40000, efficiency: 95 },
    ]
};
const DEMO_PRODUCTION_CHART = [
    { date: '2026-01-01', actual: 1200, target: 1100 },
    { date: '2026-01-02', actual: 1350, target: 1200 },
    { date: '2026-01-03', actual: 1100, target: 1250 },
    { date: '2026-01-04', actual: 1400, target: 1300 },
    { date: '2026-01-05', actual: 1550, target: 1400 },
    { date: '2026-01-06', actual: 1300, target: 1350 },
    { date: '2026-01-07', actual: 1600, target: 1500 },
];

const GridPattern = () => (
    <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none overflow-hidden">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
    </div>
);


const PricingPlan: React.FC<{ plan: any; isAnnual: boolean }> = ({ plan, isAnnual }) => {
    const isPro = plan.id === 'pro';

    const displayPrice = () => {
        if (typeof plan.price === 'string') return plan.price;
        if (typeof plan.price === 'object') {
            return `$${isAnnual ? plan.price.annual : plan.price.monthly}`;
        }
        // Fallback for simple number (though we'll update data to use objects or keep simple 0)
        return plan.price === 0 ? 'Free' : `$${plan.price}`;
    };

    return (
        <motion.div
            variants={fadeInVariant}
            whileHover={{ y: -10 }}
            className={`relative p-8 rounded-[32px] transition-all duration-500 flex flex-col h-full ${isPro
                ? 'bg-white text-slate-900 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] z-10 scale-105 border-2 border-blue-500'
                : 'bg-slate-900/50 backdrop-blur-md text-white border border-white/10'
                }`}
        >
            {isPro && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    Most Advanced
                </div>
            )}

            <div className="mb-8">
                <h3 className="text-xl font-bold tracking-tight">{plan.name}</h3>
                <p className={`text-sm mt-2 font-medium ${isPro ? 'text-slate-500' : 'text-slate-400'}`}>
                    {plan.description}
                </p>
            </div>

            <div className="mb-8">
                <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold tracking-tighter">
                        {displayPrice()}
                    </span>
                    {typeof plan.price !== 'string' && plan.price !== 0 && (
                        <span className={isPro ? 'text-slate-500' : 'text-slate-400'}>/mo</span>
                    )}
                </div>
            </div>

            <div className="flex-1 space-y-4 mb-10">
                {plan.features.map((feature: string, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                        <div className={`mt-1 p-0.5 rounded-full ${isPro ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                            <Check size={12} strokeWidth={3} />
                        </div>
                        <span className={`text-sm font-medium ${isPro ? 'text-slate-700' : 'text-slate-300'}`}>{feature}</span>
                    </div>
                ))}
            </div>

            <button className={`w-full py-4 rounded-2xl font-bold transition-all active:scale-95 ${isPro
                ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30'
                : 'bg-white/10 text-white hover:bg-white/20'
                }`}>
                {plan.cta}
            </button>
        </motion.div>
    );
};

const LandingPage: React.FC = () => {
    const { isAuthenticated } = useAuth();
    const [isAnnual, setIsAnnual] = useState(true);

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-500/30 overflow-x-hidden">

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-[100] bg-white/80 backdrop-blur-xl border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Logo variant="marketing" />
                    <div className="flex items-center gap-8">
                        <a href="#features" className="hidden md:block text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors">Platform</a>
                        <a href="#pricing" className="hidden md:block text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors">Pricing</a>
                        <Link to={isAuthenticated ? "/dashboard" : "/login"}>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="px-5 py-2 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg shadow-slate-200"
                            >
                                {isAuthenticated ? "Dashboard" : "Sign In"}
                            </motion.button>
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-40 pb-24 px-6 overflow-hidden">
                <GridPattern />
                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
                    <motion.div initial="hidden" animate="visible" variants={fadeInVariant}>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[11px] font-bold uppercase tracking-widest mb-6">
                            <Zap size={14} fill="currentColor" /> Now with AI Explainability
                        </div>
                        <h1 className="text-6xl md:text-8xl font-black leading-[0.9] tracking-tighter mb-8 italic">
                            ELIMINATE <br />
                            <span className="text-blue-600 not-italic">DOWNTIME.</span>
                        </h1>
                        <p className="text-xl font-medium text-slate-500 max-w-lg mb-10 leading-relaxed">
                            The industrial intelligence engine that transforms fragmented floor data into actionable predictive insights.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <motion.button className="px-8 py-4 rounded-2xl bg-blue-600 text-white text-lg font-bold shadow-xl shadow-blue-200 flex items-center justify-center gap-2">
                                Start Free Trial <ArrowRight size={20} />
                            </motion.button>
                            <button className="px-8 py-4 rounded-2xl bg-slate-100 text-slate-900 text-lg font-bold hover:bg-slate-200 transition-colors">
                                Watch Demo
                            </button>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...springTransition, delay: 0.2 }}
                        className="relative group"
                    >
                        <div className="absolute -inset-4 bg-gradient-to-tr from-blue-500 to-cyan-400 rounded-[40px] opacity-20 blur-3xl group-hover:opacity-30 transition-opacity" />
                        <div className="relative bg-slate-900 rounded-[32px] p-8 shadow-2xl border border-white/10 overflow-hidden">
                            <div className="flex items-center justify-between mb-8">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Real-time Efficiency</p>
                                    <p className="text-3xl font-bold text-white tracking-tighter">94.2% <span className="text-xs text-green-400 font-medium">+2.1%</span></p>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                                    <BarChart3 size={20} />
                                </div>
                            </div>
                            <div className="flex items-end h-40 gap-3">
                                {[40, 70, 45, 90, 65, 80, 95].map((h, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ height: 0 }}
                                        animate={{ height: `${h}%` }}
                                        transition={{ delay: 0.5 + (i * 0.1), ...springTransition }}
                                        className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-lg"
                                    />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Application Simulation / "Live" Demo */}
            <section className="py-24 px-6 bg-slate-50 border-b border-slate-200 overflow-hidden">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <motion.h2
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={fadeInVariant}
                            className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6"
                        >
                            Your Factory, <span className="text-blue-600">Digitized.</span>
                        </motion.h2>
                        <p className="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
                            Experience the interface that's replacing spreadsheets in 40+ facilities.
                            Real-time monitoring, auto-generated reports, and zero latency.
                        </p>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="relative w-full aspect-[16/9] md:aspect-[16/10] bg-slate-900 rounded-[32px] shadow-2xl shadow-blue-900/20 ring-1 ring-slate-900/5 p-2 md:p-4 overflow-hidden"
                    >
                        {/* Container for MiniDashboard - Scaled to fit */}
                        <div className="w-full h-full bg-white rounded-[24px] overflow-hidden relative">
                            {/* Abs positioning & Scaling to fit the fixed 1280x800 dashboard into variable container */}
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                                <div className="transform scale-[0.5] sm:scale-[0.65] md:scale-[0.8] lg:scale-[0.9] xl:scale-100 origin-center transition-transform duration-500">
                                    <MiniDashboard
                                        demoEfficiencyData={DEMO_EFFICIENCY}
                                        demoEarnedMinutesData={DEMO_EARNED_MINUTES}
                                        demoProductionData={DEMO_PRODUCTION_CHART}
                                    />
                                </div>
                            </div>

                            {/* Interactive overlay - Click to "Login" or similar */}
                            <div className="absolute inset-0 z-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 bg-slate-900/10 backdrop-blur-[2px]">
                                <Link to="/login">
                                    <button className="px-8 py-4 bg-white text-slate-900 text-lg font-bold rounded-2xl shadow-xl transform hover:scale-105 transition-transform">
                                        Try Live Demo
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features (Bento Grid) - Light & Clean */}
            <section id="features" className="py-24 px-6 bg-white">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-12 gap-6">

                        {/* THE UPGRADED WIDGET LIBRARY CARD */}
                        <div className="md:col-span-8 bg-white p-10 md:p-12 rounded-[40px] border border-slate-200 shadow-sm relative overflow-hidden group">
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-blue-200">
                                    <LayoutDashboard size={28} />
                                </div>
                                <div className="max-w-sm">
                                    <h3 className="text-4xl font-bold tracking-tight mb-4">Industrial Widget Library</h3>
                                    <p className="text-slate-500 text-lg font-medium leading-relaxed">
                                        A massive suite of specialized components for downtime, SAM variances, and shift-over-shift analysis.
                                        Built for <span className="text-slate-900 underline decoration-blue-500/30">high-density</span> monitoring.
                                    </p>
                                </div>

                                {/* The "Show" instead of "Tell" - Animated Widget Cluster */}
                                <div className="mt-12 relative h-[320px] w-full">
                                    {/* Widget 1: Target Realization (Floating Left) */}
                                    <motion.div
                                        animate={{ y: [0, -8, 0] }}
                                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                                        className="absolute left-0 top-0 z-20 w-[280px] h-[200px]"
                                    >
                                        <div className="w-full h-full bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden transform hover:scale-105 transition-transform duration-300">
                                            <MockTargetRealizationWidget w={3} h={3} data={DEMO_TARGET} />
                                        </div>
                                    </motion.div>

                                    {/* Widget 2: Speed vs Quality (Center/Right) */}
                                    <motion.div
                                        animate={{ y: [0, 10, 0] }}
                                        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                                        className="absolute left-[240px] top-[60px] z-30 w-[340px] h-[240px]"
                                    >
                                        <div className="w-full h-full bg-white rounded-2xl shadow-2xl shadow-blue-900/10 border border-slate-200 overflow-hidden transform hover:scale-105 transition-transform duration-300">
                                            <MockSpeedQualityWidget w={3} h={3} data={DEMO_SPEED_QUALITY} />
                                        </div>
                                    </motion.div>

                                    {/* Widget 3: Blocker Cloud (Right Back) */}
                                    <motion.div
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
                                        className="absolute right-0 top-0 z-10 w-[240px] h-[180px] hidden xl:block"
                                    >
                                        <div className="w-full h-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
                                            <MockBlockerCloudWidget w={3} h={2} data={DEMO_BLOCKERS} />
                                        </div>
                                    </motion.div>
                                </div>
                            </div>

                            {/* Technical Grid Background Overlay */}
                            <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] [mask-image:linear-gradient(to_left,white,transparent)]" />
                        </div>

                        {/* AI CARD (Keep as is, but maybe add a subtle glow) */}
                        <div className="md:col-span-4 bg-slate-900 p-10 rounded-[40px] text-white flex flex-col justify-between relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Zap size={120} />
                            </div>
                            <div className="space-y-4 relative z-10">
                                <div className="inline-flex px-3 py-1 bg-blue-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-400 border border-blue-500/30">Intelligence</div>
                                <h3 className="text-2xl font-bold tracking-tight">AI Transparency</h3>
                                <p className="text-slate-400 text-sm leading-relaxed">No black boxes. Our Logic Engine exports the exact decision tree used for every predictive alert.</p>
                            </div>
                            <div className="mt-8 p-4 bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 font-mono text-[10px] text-blue-300 relative z-10">
                                <div className="flex gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500/50" />
                                    <div className="w-2 h-2 rounded-full bg-amber-500/50" />
                                    <div className="w-2 h-2 rounded-full bg-green-500/50" />
                                </div>
                                <span className="text-slate-500 italic">// Analyzing pattern_delta_7...</span> <br />
                                <span className="text-blue-400">{`> confidence: 0.982`}</span> <br />
                                <span className="text-emerald-400">{`> recommendation: check_bearing_L4`}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* PRICING SECTION: THE "LEVEL UP" DESIGN */}
            <section id="pricing" className="relative py-32 px-6 bg-[#0B0F1A] overflow-hidden">
                {/* Visual Interest Backgrounds */}
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
                <GridPattern />

                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="text-center mb-20">
                        <motion.h2
                            initial="hidden" whileInView="visible" variants={fadeInVariant}
                            className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6"
                        >
                            Scale with Precision.
                        </motion.h2>

                        {/* Custom Toggle */}
                        <div className="flex items-center justify-center gap-4 mt-12">
                            <span className={`text-sm font-bold ${!isAnnual ? 'text-white' : 'text-slate-500'}`}>Monthly</span>
                            <button
                                onClick={() => setIsAnnual(!isAnnual)}
                                className="w-16 h-8 bg-slate-800 rounded-full p-1 relative flex items-center transition-colors"
                            >
                                <motion.div
                                    animate={{ x: isAnnual ? 32 : 0 }}
                                    className="w-6 h-6 bg-blue-500 rounded-full shadow-lg"
                                />
                            </button>
                            <span className={`text-sm font-bold ${isAnnual ? 'text-white' : 'text-slate-500'}`}>
                                Annual <span className="text-blue-400 ml-1">(-34%)</span>
                            </span>
                        </div>
                    </div>

                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        transition={{ staggerChildren: 0.1 }}
                        className="grid lg:grid-cols-3 gap-8 items-center"
                    >
                        {PRICING_PLANS.map((plan) => (
                            <PricingPlan key={plan.id} plan={plan} isAnnual={isAnnual} />
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* CTA / Final Section */}
            <section className="py-32 px-6">
                <div className="max-w-5xl mx-auto bg-blue-600 rounded-[48px] p-16 text-center text-white relative overflow-hidden shadow-2xl shadow-blue-200">
                    <div className="relative z-10">
                        <h2 className="text-5xl font-black tracking-tighter mb-8">Ready to digitize your floor?</h2>
                        <p className="text-xl text-blue-100 mb-10 max-w-xl mx-auto font-medium">
                            Join 40+ factories reducing downtime by an average of 18% in the first 90 days.
                        </p>
                        <button className="px-10 py-5 bg-white text-blue-600 rounded-2xl text-xl font-bold hover:scale-105 transition-transform shadow-xl">
                            Get Started Now
                        </button>
                    </div>
                    {/* Abstract circles */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                </div>
            </section>

            <footer className="py-20 px-6 border-t border-slate-100 bg-white">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <Logo variant="footer" />
                    <div className="flex gap-8 text-sm font-bold text-slate-400 uppercase tracking-widest">
                        <a href="#" className="hover:text-blue-600">Privacy</a>
                        <a href="#" className="hover:text-blue-600">Terms</a>
                        <a href="#" className="hover:text-blue-600">API</a>
                    </div>
                    <p className="text-sm text-slate-400 font-medium italic">© 2026 Industrial Prime Logic Systems.</p>
                </div>
            </footer>
        </div>
    );
};

const PRICING_PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        price: 0,
        description: 'For line managers digitizing their first floor.',
        features: ['1 Factory Limit', 'Manual CSV Uploads', 'Basic Line Efficiency', '7-Day Data Retention'],
        cta: 'Start for Free'
    },
    {
        id: 'pro',
        name: 'Professional',
        price: { monthly: 150, annual: 99 },
        description: 'For factory owners scaling compliance and output.',
        features: ['Up to 3 Factories', 'Automated ETL Pipelines', 'SAM & DHU Analysis', '90-Day Retention', 'Priority Email Support'],
        cta: 'Upgrade to Pro'
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: 'Custom',
        description: 'Global federation and UFLPA auditing.',
        features: ['Unlimited Factories', 'UFLPA Compliance Logs', 'SSO (SAML)', 'Dedicated Success Manager', 'On-Premise Option'],
        cta: 'Contact Sales'
    }
];

export default LandingPage;