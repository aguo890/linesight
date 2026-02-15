import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '../../../context/ThemeContext';
import { Logo } from '@/components/common/Logo';
import {
    ArrowRight,
    Check,
    FileSpreadsheet,
    Tablet,
    Users,
    Quote,
    BarChart3,
} from 'lucide-react';
import { MiniDashboard } from '@/components/simulation/MiniDashboard';
import { PARTNER_LOGOS } from '@/components/PartnerLogos';
import tsfLogo from '../../../assets/landing_page_brands/tsflogo.png';
import { useSnakeScroll } from '@/hooks/useSnakeScroll';
import { SnakeLane } from '@/components/SnakeLane';
import { WaitlistForm } from '@/components/WaitlistForm';
import { FeaturesSection } from '@/components/FeaturesSection';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { SEOHreflangs } from '@/components/common/SEOHreflangs';

const springTransition = { type: "spring", stiffness: 100, damping: 20 } as const;

const fadeInVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
} as const;

const colorVariant = {
    initial: {
        color: "#2563eb", // blue-600
    },
    animate: {
        color: ["#2563eb", "#2dd4bf", "#2563eb"], // Cycle: Blue -> Teal (Snake Color) -> Blue
        transition: { duration: 0.8, ease: "easeInOut" } as const
    }
};

// --- Sub-components & Data ---

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

const DEMO_EFFICIENCY = { currentEfficiency: 94.2, target: 85 };
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
    { day: '2026-01-01', actual: 1200, target: 1100 },
    { day: '2026-01-02', actual: 1350, target: 1200 },
    { day: '2026-01-03', actual: 1100, target: 1250 },
    { day: '2026-01-04', actual: 1400, target: 1300 },
    { day: '2026-01-05', actual: 1550, target: 1400 },
    { day: '2026-01-06', actual: 1300, target: 1350 },
    { day: '2026-01-07', actual: 1600, target: 1500 },
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

const PricingPlan: React.FC<{ plan: any; isAnnual: boolean; isDark: boolean }> = ({ plan, isAnnual, isDark }) => {
    const isPro = plan.id === 'pro';

    const displayPrice = () => {
        if (typeof plan.price === 'string') return plan.price;
        if (typeof plan.price === 'object') {
            return `$${isAnnual ? plan.price.annual : plan.price.monthly}`;
        }
        return plan.price === 0 ? 'Free' : `$${plan.price}`;
    };

    return (
        <motion.div
            variants={fadeInVariant}
            whileHover={{ y: -10 }}
            className={`relative p-8 rounded-[32px] transition-all duration-500 flex flex-col h-full ${isPro
                ? isDark
                    ? 'bg-slate-900 text-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.6)] z-10 scale-105 border-2 border-blue-500'
                    : 'bg-white text-slate-900 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.3)] z-10 scale-105 border-2 border-blue-500'
                : isDark
                    ? 'bg-slate-900/40 backdrop-blur-md text-white border border-white/5'
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
                        <div className={`mt-1 p-0.5 rounded-full ${isPro
                            ? isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600'
                            : 'bg-blue-500/20 text-blue-400'}`}>
                            <Check size={12} strokeWidth={3} />
                        </div>
                        <span className={`text-sm font-medium ${isPro
                            ? isDark ? 'text-slate-300' : 'text-slate-700'
                            : 'text-slate-300'}`}>{feature}</span>
                    </div>
                ))}
            </div>

            <Link to={plan.id === 'enterprise' ? "/contact" : `/register?plan=${plan.id}&billing=${isAnnual ? 'annual' : 'monthly'}`} className="w-full">
                <button className={`w-full py-4 rounded-2xl font-bold transition-all active:scale-95 ${isPro
                    ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/30'
                    : 'bg-white/10 text-white hover:bg-white/20'
                    }`}>
                    {plan.cta}
                </button>
            </Link>
        </motion.div>
    );
};

// BackgroundTrendline removed in favor of SnakeLane

// Shared constants to ensure the loop gap exactly matches the item gap.
const MARQUEE_SPACING = "gap-16";

const LogoSet = ({ logos, ariaHidden }: { logos: string[], ariaHidden?: boolean }) => (
    <div className={`flex ${MARQUEE_SPACING} pr-16 items-center shrink-0`} aria-hidden={ariaHidden}>
        {logos.map((logoUrl, i) => (
            <div
                key={i}
                className="group flex flex-col items-center justify-center gap-2 cursor-pointer"
            >
                <div className="transition-all duration-500 opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-110">
                    <img
                        src={logoUrl}
                        alt={`Partner logo ${i + 1}`}
                        className="w-auto h-16 object-contain dark:invert"
                    />
                </div>
            </div>
        ))}
    </div>
);

const LandingPage: React.FC = () => {
    const { t } = useTranslation('landing');
    const { lang = 'en' } = useParams<{ lang: string }>();
    const { isAuthenticated } = useAuth();
    const { resolvedTheme } = useTheme();
    // --- CONFIGURATION ---
    const IS_WAITLIST_MODE = true;
    const WAITLIST_SECTION_ID = "waitlist-form-section";

    // --- ROUTES (locale-aware) ---
    const ROUTES = {
        LOGIN: `/${lang}/login`,
        REGISTER: `/${lang}/register`,
    };

    const [isAnnual, setIsAnnual] = useState(true);
    const isDark = resolvedTheme === 'dark';

    // 🟢 Dynamic Pricing Data (Must be inside component to use 't')
    const PRICING_PLANS = useMemo(() => [
        {
            id: 'starter',
            name: t('pricing.plans.starter.name'),
            price: { monthly: 49, annual: 39 }, // Keeping existing structure for PricingPlan component
            description: t('pricing.plans.starter.description'),
            features: t('pricing.plans.starter.features', { returnObjects: true }) as string[],
            cta: t('pricing.plans.starter.cta'),
            popular: false
        },
        {
            id: 'pro',
            name: t('pricing.plans.pro.name'),
            price: { monthly: 199, annual: 159 },
            description: t('pricing.plans.pro.description'),
            features: t('pricing.plans.pro.features', { returnObjects: true }) as string[],
            cta: t('pricing.plans.pro.cta'),
            popular: true
        },
        {
            id: 'enterprise',
            name: t('pricing.plans.enterprise.name'),
            price: 'Custom',
            description: t('pricing.plans.enterprise.description'),
            features: t('pricing.plans.enterprise.features', { returnObjects: true }) as string[],
            cta: t('pricing.plans.enterprise.cta'),
            popular: false
        }
    ], [t]);

    // snake scroll logic
    const snakeContainerRef = useRef<HTMLDivElement>(null);
    const snakeProgress = useSnakeScroll(snakeContainerRef);

    const [isSnakeFinished, setIsSnakeFinished] = useState(false);

    useEffect(() => {
        // Subscribe to MotionValue changes without triggering re-renders on every pixel
        return snakeProgress.on("change", (latest) => {
            if (latest > 0.99) {
                setIsSnakeFinished(true);
            } else if (latest < 0.90) {
                setIsSnakeFinished(false);
            }
        });
    }, [snakeProgress]);

    // --- SCROLL HANDLER ---
    const scrollToWaitlist = () => {
        const element = document.getElementById(WAITLIST_SECTION_ID);
        if (element) {
            element.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <div className="min-h-screen font-sans selection:bg-blue-500/30 overflow-x-hidden transition-colors duration-300 bg-white text-slate-900 dark:bg-slate-950 dark:text-white">

            {/* SEO Hreflang tags for multi-language indexing */}
            <SEOHreflangs currentPath="/" />

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-[100] backdrop-blur-xl border-b transition-colors duration-300 bg-white/80 border-slate-100 dark:bg-slate-950/80 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
                    <Logo variant="marketing" textClassName="text-lg md:text-xl" />
                    <div className="flex items-center gap-3 md:gap-6">
                        {!IS_WAITLIST_MODE && (
                            <>
                                <a href="#features" className={`hidden md:block text-sm font-semibold transition-colors ${isDark ? 'text-slate-400 hover:text-blue-400' : 'text-slate-500 hover:text-blue-600'}`}>Platform</a>
                                <a href="#pricing" className={`hidden md:block text-sm font-semibold transition-colors ${isDark ? 'text-slate-400 hover:text-blue-400' : 'text-slate-500 hover:text-blue-600'}`}>Pricing</a>
                            </>
                        )}

                        {/* Language Switcher */}
                        <LanguageSwitcher />

                        {/* Always show Sign In explicitly */}
                        <Link to={ROUTES.LOGIN} className={`text-xs md:text-sm font-semibold transition-colors ${isDark ? 'text-slate-400 hover:text-blue-400' : 'text-slate-500 hover:text-blue-600'}`}>
                            {t('nav.sign_in')}
                        </Link>

                        {IS_WAITLIST_MODE ? (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={scrollToWaitlist}
                                className={`px-3 py-2 md:px-5 rounded-full text-xs md:text-sm font-bold shadow-lg ${isDark ? 'bg-white text-slate-900 shadow-slate-900/20' : 'bg-slate-900 text-white shadow-slate-200'}`}
                            >
                                {t('nav.join_waitlist')}
                            </motion.button>
                        ) : (
                            <Link to={isAuthenticated ? "/dashboard" : ROUTES.REGISTER}>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`px-3 py-2 md:px-5 rounded-full text-xs md:text-sm font-bold shadow-lg ${isDark ? 'bg-white text-slate-900 shadow-slate-900/20' : 'bg-slate-900 text-white shadow-slate-200'}`}
                                >
                                    {isAuthenticated ? t('nav.dashboard') : t('nav.get_started')}
                                </motion.button>
                            </Link>
                        )}
                    </div>
                </div>
            </nav>


            {/* Refined Hero Section */}
            <section className="relative pt-40 pb-24 px-6 overflow-hidden">
                {/* Background Grid Pattern (Existing) */}
                <GridPattern />

                <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center relative z-10">
                    <motion.div initial="hidden" animate="visible" variants={fadeInVariant}>

                        {/* IMPROVEMENT 1: The Modern Badge */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest mb-8 border border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400">
                            <span className="relative flex h-2 w-2 mr-1">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            {t('hero.badge')}
                        </div>

                        <h1 className="text-6xl md:text-8xl font-black leading-[0.9] tracking-tighter mb-8 text-slate-900 dark:text-white">
                            {t('hero.headline')} <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">{t('hero.headline_accent')}</span>
                        </h1>

                        <p className="text-xl font-medium max-w-lg mb-10 leading-relaxed text-slate-500 dark:text-slate-400">
                            {t('hero.subheadline')}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            {/* IMPROVEMENT 2: Colored Shadow Button */}
                            {IS_WAITLIST_MODE ? (
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={scrollToWaitlist}
                                    className="px-8 py-4 rounded-2xl bg-blue-600 text-white text-lg font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all"
                                >
                                    {t('hero.cta_waitlist')} <ArrowRight size={20} className="rtl:rotate-180" />
                                </motion.button>
                            ) : (
                                <Link to={ROUTES.REGISTER}>
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                        className="px-8 py-4 rounded-2xl bg-blue-600 text-white text-lg font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all"
                                    >
                                        {t('hero.cta_trial')} <ArrowRight size={20} className="rtl:rotate-180" />
                                    </motion.button>
                                </Link>
                            )}

                            <button className="px-8 py-4 rounded-2xl text-lg font-bold transition-colors bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">
                                {t('hero.cta_demo')}
                            </button>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...springTransition, delay: 0.2 }}
                        className="relative group"
                    >
                        {/* IMPROVEMENT 3: Ambient Glow Behind Dashboard */}
                        <div className="absolute -inset-4 bg-blue-500/30 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />

                        <div className="relative bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden">
                            <div className="flex items-center justify-between mb-8">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest">{t('demo.stats.label')}</p>
                                    <p className="text-3xl font-bold text-slate-900 dark:text-white tracking-tighter">{t('demo.stats.value')} <span className="text-xs text-green-500 font-medium">{t('demo.stats.change')}</span></p>
                                </div>
                                <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                    <BarChart3 size={20} />
                                </div>
                            </div>
                            {/* Graph bars */}
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

            {/* --- NEW SECTION: The Brand Marquee (Trust) --- */}
            <div className="py-12 border-y overflow-hidden whitespace-nowrap bg-slate-50 border-slate-200 dark:bg-slate-950 dark:border-slate-800">
                <div className="text-center mb-6">
                    <p className="text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {t('trust.powering')}
                    </p>
                </div>

                {/* Infinite Scroll Marquee - CSS Solution */}
                <div className="relative flex overflow-hidden mask-gradient-x py-6">
                    {/* Fade Masks */}
                    <div className="absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950" />
                    <div className="absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950" />

                    <div className="flex animate-marquee shrink-0">
                        <LogoSet logos={PARTNER_LOGOS} />
                        <LogoSet logos={PARTNER_LOGOS} ariaHidden={true} />
                        <LogoSet logos={PARTNER_LOGOS} ariaHidden={true} />
                        <LogoSet logos={PARTNER_LOGOS} ariaHidden={true} />
                    </div>
                </div>
            </div>

            {/* --- NEW SECTION: The Problem/Solution Snake Layout --- */}
            <div ref={snakeContainerRef} className={`relative w-full pt-16 pb-16 md:pt-57 md:pb-15 transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>

                {/* The Responsive Grid Architecture */}
                <div className="relative max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_120px_1fr] gap-4">

                    {/* COLUMN 1: Left Content */}
                    <div className="flex flex-col gap-12 md:gap-96 py-4 md:py-20 px-6 text-center md:text-right">
                        {/* Card 1: Spreadsheets */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            className={`group relative p-8 rounded-[32px] border text-left transition-all duration-300 hover:-translate-y-1 ${isDark
                                ? 'bg-slate-900 border-slate-800 hover:border-red-500/50 hover:shadow-2xl hover:shadow-red-900/20'
                                : 'bg-white border-slate-200 hover:border-red-200 hover:shadow-xl hover:shadow-red-100'
                                }`}>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${isDark ? 'bg-slate-800 text-red-400' : 'bg-red-50 text-red-600'
                                }`}>
                                <FileSpreadsheet size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4 tracking-tight">{t('problems.spreadsheets.title')}</h3>
                            <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} leading-relaxed font-medium`}>
                                {t('problems.spreadsheets.description')}
                            </p>
                        </motion.div>

                        {/* Card 3: Accountability */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            className={`group relative p-8 rounded-[32px] border text-left transition-all duration-300 hover:-translate-y-1 ${isDark
                                ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-900/20'
                                : 'bg-white border-slate-200 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-100'
                                }`}>
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
                                }`}>
                                <Users size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4 tracking-tight">{t('problems.accountability.title')}</h3>
                            <p className={`${isDark ? 'text-slate-400' : 'text-slate-500'} leading-relaxed font-medium`}>
                                {t('problems.accountability.description')}
                            </p>
                        </motion.div>
                    </div>

                    {/* COLUMN 2: The Snake Lane */}
                    {/* COLUMN 2: The Snake Lane */}
                    <div className="relative h-full hidden md:block w-full" aria-hidden="true">
                        {/* Absolute positioning ensures it overlays the grid column perfectly without affecting flow */}
                        <div className="absolute inset-0 w-full h-full">
                            <SnakeLane progress={snakeProgress} isDark={isDark} />
                        </div>
                    </div>

                    {/* COLUMN 3: Right Content */}
                    <div className="flex flex-col gap-12 md:gap-96 py-4 md:py-20 px-6 text-center md:text-left mt-0 md:mt-64">
                        {/* mt-64 offsets the right side to create a stagger effect */}

                        {/* Card 2: ERP */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            className={`group relative p-8 rounded-[32px] border text-left transition-all duration-300 hover:-translate-y-1 ${isDark
                                ? 'bg-gradient-to-b from-slate-800 to-slate-900 border-blue-500/30 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-900/20'
                                : 'bg-white border-blue-200 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-100'
                                }`}>
                            {/* "Recommended" Badge for visual break */}
                            <div className="absolute top-6 right-6">
                                <div className={`w-2 h-2 rounded-full ${isDark ? 'bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-blue-500'}`} />
                            </div>

                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110 ${isDark ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-50 text-blue-600'
                                }`}>
                                <Tablet size={28} strokeWidth={1.5} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4 tracking-tight">{t('problems.erp.title')}</h3>
                            <p className={`${isDark ? 'text-slate-300' : 'text-slate-600'} leading-relaxed font-medium`}>
                                {t('problems.erp.description')}
                            </p>
                        </motion.div>
                    </div>

                </div>
            </div>

            {/* --- NEW SECTION: Social Proof (Bridge to Demo) --- */}
            <section className={`py-20 px-6 border-t ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="max-w-4xl mx-auto text-center">
                    <Quote size={48} className="mx-auto mb-8 text-blue-500 opacity-50" />

                    <h2 className="text-2xl md:text-3xl font-medium tracking-tight mb-8 leading-relaxed text-slate-700 dark:text-slate-200">
                        "{t('social_proof.quote_part1')}
                        <motion.span
                            variants={colorVariant}
                            initial="initial"
                            animate={isSnakeFinished ? "animate" : "initial"}
                            className="block mt-6 text-3xl md:text-4xl font-bold text-blue-600"
                        >
                            {t('social_proof.quote_part2')}"
                        </motion.span>
                    </h2>

                    <div className="flex items-center justify-center gap-4 mt-10">
                        <div className="h-12 w-12 rounded-full bg-white overflow-hidden border border-slate-200 flex items-center justify-center">
                            <img src={tsfLogo} alt="Three Stars Fashion Logo" className="w-full h-full object-contain p-1" />
                        </div>
                        <div className="text-left rtl:text-right">
                            <div className="font-bold">{t('social_proof.attribution_role')}</div>
                            <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('social_proof.attribution_company')}</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Application Simulation / "Live" Demo */}
            <section className={`py-24 px-6 border-b overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <motion.h2
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            variants={fadeInVariant}
                        >
                            {t('demo.title')} <span className="text-blue-600">{t('demo.title_accent')}</span>
                        </motion.h2>
                        <p className={`text-xl max-w-2xl mx-auto font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {t('demo.subtitle')}
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
                        <div className={`w-full h-full rounded-[24px] overflow-hidden relative ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
                            {/* Abs positioning & Scaling to fit the fixed 1280x800 dashboard into variable container */}
                            <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <div className="transform scale-[0.27] sm:scale-[0.45] md:scale-[0.55] lg:scale-[0.75] xl:scale-[0.95] origin-center transition-transform duration-500">
                                    <MiniDashboard
                                        isDark={isDark}
                                        demoEfficiencyData={DEMO_EFFICIENCY}
                                        demoEarnedMinutesData={DEMO_EARNED_MINUTES}
                                        demoProductionData={DEMO_PRODUCTION_CHART}
                                    />
                                </div>
                            </div>

                            {/* Interactive overlay */}
                            <div className={`absolute inset-0 z-50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300 ${isDark ? 'bg-slate-950/50 backdrop-blur-[2px]' : 'bg-slate-900/10 backdrop-blur-[2px]'}`}>
                                <Link to="/login">
                                    <button className="px-8 py-4 bg-white text-slate-900 text-lg font-bold rounded-2xl shadow-xl transform hover:scale-105 transition-transform">
                                        {t('demo.cta')}
                                    </button>
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Features (Bento Grid) - Light & Clean */}
            {!IS_WAITLIST_MODE && (
                <>
                    <FeaturesSection
                        isDark={isDark}
                        demoTarget={DEMO_TARGET}
                        demoSpeedQuality={DEMO_SPEED_QUALITY}
                        demoBlockers={DEMO_BLOCKERS}
                    />

                    {/* PRICING SECTION */}
                    <section id="pricing" className={`relative py-32 px-6 overflow-hidden transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-[#0B0F1A]'}`}>
                        {/* Visual Interest Backgrounds */}
                        <div className={`absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] ${isDark ? 'bg-blue-600/10' : 'bg-blue-600/20'}`} />
                        <div className={`absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] ${isDark ? 'bg-indigo-600/5' : 'bg-indigo-600/10'}`} />
                        <GridPattern />

                        <div className="max-w-7xl mx-auto relative z-10">
                            <div className="text-center mb-20">
                                <motion.h2
                                    initial="hidden" whileInView="visible" variants={fadeInVariant}
                                    className="text-5xl md:text-7xl font-bold tracking-tight text-white mb-6"
                                >
                                    {t('pricing.title')}
                                </motion.h2>

                                {/* Custom Toggle */}
                                <div className="flex items-center justify-center gap-4 mt-12">
                                    <span className={`text-sm font-bold ${!isAnnual ? 'text-white' : 'text-slate-500'}`}>{t('pricing.monthly')}</span>
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
                                        {t('pricing.yearly')} <span className="text-blue-400 ml-1">{t('pricing.save_badge')}</span>
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
                                    <PricingPlan key={plan.id} plan={plan} isAnnual={isAnnual} isDark={isDark} />
                                ))}
                            </motion.div>
                        </div>
                    </section>
                </>
            )}

            {/* CTA / Final Section (The Destination) */}
            <section
                id={WAITLIST_SECTION_ID}
                className={`py-32 px-6 transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-white'}`}
            >
                <div className="max-w-5xl mx-auto text-center relative z-10">
                    {IS_WAITLIST_MODE ? (
                        /* --- WAITLIST MODE CONTENT --- */
                        <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4">
                            <h2 className={`text-4xl md:text-5xl font-black tracking-tighter mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {t('waitlist.title')}
                            </h2>
                            <p className={`text-xl mb-10 max-w-xl mx-auto font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {t('waitlist.subtitle')}
                            </p>

                            <WaitlistForm />
                        </div>
                    ) : (
                        /* --- LAUNCH MODE CONTENT --- */
                        <div className="rounded-[48px] p-16 text-white relative overflow-hidden shadow-2xl bg-blue-600 shadow-blue-200 dark:bg-blue-700 dark:shadow-blue-900/40">
                            <div className="relative z-10">
                                <h2 className="text-5xl font-black tracking-tighter mb-8">{t('cta.title')}</h2>
                                <p className={`text-xl mb-10 max-w-xl mx-auto font-medium ${isDark ? 'text-blue-100/80' : 'text-blue-100'}`}>
                                    {t('cta.subtitle')}
                                </p>
                                <Link to={ROUTES.REGISTER}>
                                    <button className="px-10 py-5 bg-white text-blue-600 rounded-2xl text-xl font-bold hover:scale-105 transition-transform shadow-xl dark:hover:bg-blue-50">
                                        {t('cta.button')}
                                    </button>
                                </Link>
                            </div>
                            {/* Abstract circles */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2" />
                        </div>
                    )}
                </div>
            </section>

            <footer className={`py-20 px-6 border-t transition-colors duration-300 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <Logo variant="footer" />
                    <div className={`flex gap-8 text-sm font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        <a href="#" className="hover:text-blue-600">{t('footer.privacy')}</a>
                        <a href="#" className="hover:text-blue-600">{t('footer.terms')}</a>
                        <a href="#" className="hover:text-blue-600">{t('footer.api')}</a>
                    </div>
                    <p className={`text-sm font-medium italic ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('footer.copyright')}</p>
                </div>
            </footer>
        </div>
    );
};



export default LandingPage;