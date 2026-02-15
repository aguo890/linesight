/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { LayoutDashboard, Zap } from 'lucide-react';
import { MockSpeedQualityWidget } from '@/features/landing/components/simulation/MockSpeedQualityWidget';
import { MockTargetRealizationWidget } from '@/features/landing/components/simulation/MockTargetRealizationWidget';
import { MockBlockerCloudWidget } from '@/features/landing/components/simulation/MockBlockerCloudWidget';

interface FeaturesSectionProps {
    isDark: boolean;
    demoTarget: any;
    demoSpeedQuality: any;
    demoBlockers: any;
}

export const FeaturesSection: React.FC<FeaturesSectionProps> = ({
    isDark,
    demoTarget,
    demoSpeedQuality,
    demoBlockers
}) => {
    // Parallax Logic for "Industrial Widget Library"
    const widgetSectionRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: widgetSectionRef,
        offset: ["start end", "end start"]
    });

    const yLayer1 = useTransform(scrollYProgress, [0, 1], [0, -60]);  // TargetRealization
    const yLayer2 = useTransform(scrollYProgress, [0, 1], [0, -120]); // SpeedQuality (Closer/Faster)
    const yLayer3 = useTransform(scrollYProgress, [0, 1], [0, -30]);  // BlockerCloud (Farther/Slower)

    return (
        <section id="features" className={`py-24 px-6 transition-colors duration-300 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
            <div className="max-w-7xl mx-auto">
                <div className="grid md:grid-cols-12 gap-6">

                    {/* THE UPGRADED WIDGET LIBRARY CARD */}
                    <div ref={widgetSectionRef} className={`md:col-span-8 p-10 md:p-12 rounded-[40px] border shadow-sm relative overflow-hidden group transition-colors duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white mb-8 shadow-lg shadow-blue-200 dark:shadow-blue-900/50">
                                <LayoutDashboard size={28} />
                            </div>
                            <div className="max-w-sm">
                                <h3 className="text-4xl font-bold tracking-tight mb-4">Industrial Widget Library</h3>
                                <p className={`text-lg font-medium leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    A massive suite of specialized components for downtime, SAM variances, and shift-over-shift analysis.
                                    Built for <span className={`underline decoration-blue-500/30 ${isDark ? 'text-white' : 'text-slate-900'}`}>high-density</span> monitoring.
                                </p>
                            </div>

                            {/* The "Show" instead of "Tell" - Animated Widget Cluster */}
                            <div className="mt-12 relative h-[320px] w-full">
                                {/* Widget 1: Target Realization (Floating Left) */}
                                <motion.div
                                    style={{ y: yLayer1 }}
                                    className="absolute left-0 top-0 z-20 w-[280px] h-[200px]"
                                >
                                    <div className={`w-full h-full rounded-2xl shadow-xl border overflow-hidden transform hover:scale-105 transition-transform duration-300 ${isDark ? 'bg-slate-800 border-blue-900/50' : 'bg-white border-blue-100'}`}>
                                        <MockTargetRealizationWidget w={3} h={3} data={demoTarget} isDark={isDark} />
                                    </div>
                                </motion.div>

                                {/* Widget 2: Speed vs Quality (Center/Right) */}
                                <motion.div
                                    style={{ y: yLayer2 }}
                                    className="absolute left-[240px] top-[60px] z-30 w-[340px] h-[240px]"
                                >
                                    <div className={`w-full h-full rounded-2xl shadow-2xl shadow-blue-900/10 border overflow-hidden transform hover:scale-105 transition-transform duration-300 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                        <MockSpeedQualityWidget w={3} h={3} data={demoSpeedQuality} isDark={isDark} />
                                    </div>
                                </motion.div>

                                {/* Widget 3: Blocker Cloud (Right Back) */}
                                <motion.div
                                    style={{ y: yLayer3 }}
                                    className="absolute right-0 top-0 z-10 w-[240px] h-[180px] hidden xl:block"
                                >
                                    <div className={`w-full h-full backdrop-blur-sm rounded-2xl shadow-lg border overflow-hidden ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white/80 border-slate-100'}`}>
                                        <MockBlockerCloudWidget w={3} h={2} data={demoBlockers} isDark={isDark} />
                                    </div>
                                </motion.div>
                            </div>
                        </div>

                        {/* Technical Grid Background Overlay */}
                        <div className={`absolute top-0 right-0 w-1/2 h-full [background-size:20px_20px] [mask-image:linear-gradient(to_left,white,transparent)] ${isDark ? 'bg-[radial-gradient(#334155_1px,transparent_1px)]' : 'bg-[radial-gradient(#e2e8f0_1px,transparent_1px)]'}`} />
                    </div>

                    {/* AI CARD */}
                    <div className="md:col-span-4 p-10 rounded-[40px] flex flex-col justify-between relative overflow-hidden group transition-colors duration-300 bg-slate-900 text-white">
                        <div className={`absolute top-0 right-0 p-8 transition-opacity ${isDark ? 'opacity-10 group-hover:opacity-20' : 'opacity-10 group-hover:opacity-20'}`}>
                            <Zap size={120} />
                        </div>
                        <div className="space-y-4 relative z-10">
                            <div className={`inline-flex px-3 py-1 bg-blue-500/20 rounded-full text-[10px] font-bold uppercase tracking-widest text-blue-400 border border-blue-500/30 ${isDark ? '' : ''}`}>Intelligence</div>
                            <h3 className="text-2xl font-bold tracking-tight">AI Transparency</h3>
                            <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>No black boxes. Our Logic Engine exports the exact decision tree used for every predictive alert.</p>
                        </div>
                        <div className={`mt-8 p-4 bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 font-mono text-[10px] relative z-10 ${isDark ? 'text-blue-300' : 'text-blue-300'}`}>
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
    );
};
