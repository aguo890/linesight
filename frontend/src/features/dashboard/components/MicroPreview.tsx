import React from 'react';

// --- Types ---
export type SampleDataMap = Record<string, (string | number | null)[]>;

interface MicroPreviewProps {
    widgetId: string;
    sampleData: SampleDataMap;
    isSupported: boolean;
}

/**
 * Global Wrapper for all signatures to add the "Simulated" watermark
 * and ensure consistent layout.
 */
const SignatureWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="relative w-full h-full flex flex-col justify-center overflow-hidden group">
        {children}
        <div className="absolute top-0 end-0 opacity-20 group-hover:opacity-40 transition-opacity text-[6px] font-black uppercase tracking-tighter text-text-muted pointer-events-none pe-1 pt-0.5">
            Simulated
        </div>
    </div>
);

// --- Component: SignatureProduction (Area Chart Sync) ---
const SignatureProduction: React.FC<{ actual: number[]; target: number[] }> = ({ actual, target }) => {
    const width = 100;
    const height = 60;
    const max = Math.max(...actual, ...target, 1) * 1.1;

    const getPoints = (arr: number[]) => arr.map((val, i) => {
        const x = (i / (arr.length - 1)) * width;
        const y = height - (val / max) * height;
        return `${x},${y}`;
    }).join(' ');

    const actualPoints = getPoints(actual);
    const targetPoints = getPoints(target);
    const actualArea = `${actualPoints} ${width},${height} 0,${height}`;
    const targetArea = `${targetPoints} ${width},${height} 0,${height}`;

    return (
        <SignatureWrapper>
            <div className="flex justify-between text-[6px] text-text-muted mb-1 px-1 font-bold tracking-tighter">
                <span className="flex items-center gap-0.5"><div className="w-1 h-1 bg-text-muted" /> PLANNED</span>
                <span className="flex items-center gap-0.5"><div className="w-1 h-1 bg-brand" /> ACTUAL</span>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 overflow-visible" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" className="text-brand" stopColor="currentColor" stopOpacity="0.2" />
                        <stop offset="100%" className="text-brand" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="slateGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" className="text-text-muted" stopColor="currentColor" stopOpacity="0.1" />
                        <stop offset="100%" className="text-text-muted" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {/* Target Area */}
                <polyline points={targetArea} fill="url(#slateGrad)" stroke="none" />
                <polyline points={targetPoints} fill="none" className="text-text-muted" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
                {/* Actual Area */}
                <polyline points={actualArea} fill="url(#blueGrad)" stroke="none" />
                <polyline points={actualPoints} fill="none" className="text-brand" stroke="currentColor" strokeWidth="1.5" pathLength="100" />
            </svg>
        </SignatureWrapper>
    );
};

// --- Component: SignatureSAM (Composed Chart: Bar + Line) ---
const SignatureSAM: React.FC<{ actual: number[]; standard: number[] }> = ({ actual, standard }) => {
    const width = 100;
    const height = 60;
    const max = Math.max(...actual, ...standard, 1) * 1.2;

    return (
        <SignatureWrapper>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 overflow-visible" preserveAspectRatio="none">
                {/* Standard Line */}
                <polyline
                    points={standard.map((v, i) => `${(i / (standard.length - 1)) * width},${height - (v / max) * height}`).join(' ')}
                    fill="none" className="text-warning" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                />
                {/* Actual Bars */}
                {actual.map((v, i) => {
                    const barWidth = width / actual.length * 0.6;
                    const x = (i / (actual.length - 1)) * (width - barWidth);
                    const barHeight = (v / max) * height;
                    return (
                        <rect
                            key={i} x={x} y={height - barHeight} width={barWidth} height={barHeight}
                            className="text-brand-secondary" fill="currentColor" rx="1"
                        />
                    );
                })}
            </svg>
            <div className="mt-1 flex justify-center gap-2">
                <span className="text-[5px] text-brand-secondary font-bold uppercase tracking-tighter">Actual (Bar)</span>
                <span className="text-[5px] text-warning font-bold uppercase tracking-tighter">Target (Line)</span>
            </div>
        </SignatureWrapper>
    );
};

// --- Component: SignatureEarnedMinutes (KPI Card Grid) ---
const SignatureEarnedMinutes: React.FC = () => (
    <SignatureWrapper>
        <div className="grid grid-cols-2 gap-2 px-1">
            <div className="col-span-2 bg-brand/5 rounded-sm p-1.5 border border-brand/10 flex justify-between items-center">
                <span className="text-[6px] font-bold text-text-muted uppercase">Efficiency</span>
                <span className="text-[10px] font-black text-brand">84.2%</span>
            </div>
            <div className="bg-warning/5 rounded-sm p-1 border border-warning/10 flex flex-col items-center">
                <span className="text-[5px] font-bold text-warning uppercase mb-0.5">Earned</span>
                <span className="text-[8px] font-black text-warning">1.2k</span>
            </div>
            <div className="bg-surface-subtle/50 rounded-sm p-1 border border-border flex flex-col items-center">
                <span className="text-[5px] font-bold text-text-muted uppercase mb-0.5">Avail</span>
                <span className="text-[8px] font-black text-text-main">1.4k</span>
            </div>
        </div>
    </SignatureWrapper>
);

// --- Component: SignatureEfficiency (Radial + KPI) ---
const SignatureEfficiency: React.FC<{ value: number }> = ({ value }) => {
    const radius = 15;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (Math.min(value, 100) / 100) * circ;

    return (
        <SignatureWrapper>
            <div className="flex items-center gap-4 w-full h-full px-2">
                <div className="relative w-14 h-14">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r={radius} fill="none" className="text-border" stroke="currentColor" strokeWidth="3" />
                        <circle
                            cx="20" cy="20" r={radius} fill="none"
                            className={value >= 85 ? "text-success" : "text-warning"}
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeDasharray={circ}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            pathLength="100"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[8px] font-black text-brand">{Math.round(value)}</span>
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-black leading-none text-text-main">{value}%</span>
                    <span className="text-[7px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Efficiency</span>
                    <div className="flex items-center gap-0.5 mt-1">
                        <div className={`w-1 h-1 rounded-full ${value >= 85 ? 'bg-success' : 'bg-warning'} animate-pulse`} />
                        <span className="text-[6px] font-bold text-text-muted">{value >= 85 ? 'ON TARGET' : 'NEAR MISS'}</span>
                    </div>
                </div>
            </div>
        </SignatureWrapper>
    );
};

// --- Component: SignatureQuality (DHU + Threshold Sync) ---
const SignatureQuality: React.FC<{ data: number[] }> = ({ data }) => {
    const width = 100;
    const height = 60;
    const max = 5; // Scale up to 5%
    const threshold = 2.5;

    const getPoint = (val: number, i: number) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (val / max) * height;
        return { x, y };
    };

    const points = data.map((v, i) => {
        const p = getPoint(v, i);
        return `${p.x},${p.y}`;
    }).join(' ');

    const threshY = height - (threshold / max) * height;
    const lastVal = data[data.length - 1] || 0;

    // Red Area for Above Limit
    const areaPoints = data.map((v, i) => {
        const p = getPoint(v, i);
        // If value is above threshold, use actual point, otherwise clamp to threshold line
        const displayY = v > threshold ? p.y : threshY;
        return `${p.x},${displayY}`;
    }).join(' ');
    const redArea = `${areaPoints} ${width},${threshY} 0,${threshY}`;

    return (
        <SignatureWrapper>
            <div className="flex justify-between items-center mb-1 px-1">
                <span className={`text-[10px] font-black ${lastVal > threshold ? 'text-error' : 'text-text-main'}`}>{lastVal.toFixed(1)}%</span>
                {lastVal > threshold && (
                    <span className="text-[5px] bg-error/10 text-error px-1 py-0.2 rounded font-black animate-pulse uppercase border border-error/20">Critical</span>
                )}
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 overflow-visible" preserveAspectRatio="none">
                {/* Error threshold fill */}
                <polyline points={redArea} className="text-error" fill="currentColor" fillOpacity="0.1" stroke="none" />
                {/* Threshold Line */}
                <line x1="0" y1={threshY} x2={width} y2={threshY} className="text-warning" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1" />
                {/* DHU Line */}
                <polyline points={points} fill="none" className="text-error" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
        </SignatureWrapper>
    );
};

// --- Component: SignatureSpeedQuality (Dual Axis Line/Bar Sync) ---
const SignatureSpeedQuality: React.FC<{ efficiency: number[]; dhu: number[] }> = ({ efficiency, dhu }) => {
    const width = 100;
    const height = 60;

    // Efficiency Scale (0-100)
    const getEffPoint = (v: number, i: number) => ({
        x: (i / (efficiency.length - 1)) * width,
        y: height - (v / 100) * height
    });

    // DHU Scale (0-5)
    const getDhuRect = (v: number, i: number) => {
        const barWidth = width / dhu.length * 0.5;
        const x = (i / (dhu.length - 1)) * (width - barWidth);
        const barHeight = (v / 5) * (height / 2); // Keep DHU spikes in lower half
        return { x, y: height - barHeight, w: barWidth, h: barHeight };
    };

    const effPoints = efficiency.map((v, i) => {
        const p = getEffPoint(v, i);
        return `${p.x},${p.y}`;
    }).join(' ');

    return (
        <SignatureWrapper>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 overflow-visible" preserveAspectRatio="none">
                {/* DHU Bars (Bottom Spikes) */}
                {dhu.map((v, i) => {
                    const r = getDhuRect(v, i);
                    return <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} className="text-error" fill="currentColor" opacity="0.4" rx="0.5" />;
                })}
                {/* Efficiency Line (Top Trend) */}
                <polyline points={effPoints} fill="none" className="text-brand" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex justify-between px-1 mt-1">
                <span className="text-[5px] text-brand font-bold uppercase tracking-tighter">Efficiency %</span>
                <span className="text-[5px] text-error font-bold uppercase tracking-tighter">Quality DHU</span>
            </div>
        </SignatureWrapper>
    );
};

// --- Component: SignatureStyleProgress (Multi-Progress) ---
const SignatureStyleProgress: React.FC = () => {
    const samples = [
        { code: 'S-702', p: 82, color: 'bg-blue-500' },
        { code: 'S-841', p: 64, color: 'bg-purple-500' },
        { code: 'S-219', p: 45, color: 'bg-indigo-500' }
    ];

    return (
        <SignatureWrapper>
            <div className="w-full flex flex-col gap-1.5 py-1 px-1">
                {samples.map((s, i) => (
                    <div key={i} className="flex flex-col gap-0.5">
                        <div className="flex justify-between text-[6px] font-bold text-text-muted tracking-tighter">
                            <span>{s.code}</span>
                            <span>{s.p}%</span>
                        </div>
                        <div className="h-2 w-full bg-surface-subtle rounded-full overflow-hidden border border-border/50">
                            <div
                                className={`h-full ${s.color} transition-all duration-1000 ease-out`}
                                style={{ width: `${s.p}%`, animation: `grow-up 0.8s ease-out ${i * 0.1}s forwards`, transformOrigin: 'left', transform: 'scaleX(0)' }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </SignatureWrapper>
    );
};

// --- Component: SignatureWorkforce (Pills) ---
const SignatureWorkforce: React.FC = () => (
    <SignatureWrapper>
        <div className="flex flex-col gap-2 w-full px-1">
            <div className="flex gap-1.5">
                <div className="flex-1 bg-success/5 border border-success/10 p-2 rounded flex flex-col items-center">
                    <span className="text-[16px] font-black text-success leading-none">42</span>
                    <span className="text-[6px] text-success/70 font-bold uppercase tracking-tighter mt-1">Ops</span>
                </div>
                <div className="flex-1 bg-brand/5 border border-brand/10 p-2 rounded flex flex-col items-center">
                    <span className="text-[16px] font-black text-brand leading-none">12</span>
                    <span className="text-[6px] text-brand/70 font-bold uppercase tracking-tighter mt-1">Helps</span>
                </div>
            </div>
            <div className="flex items-center justify-center gap-1">
                <div className="w-1 h-1 bg-success rounded-full animate-pulse" />
                <span className="text-[7px] font-bold text-text-muted uppercase tracking-widest leading-none">Active</span>
            </div>
        </div>
    </SignatureWrapper>
);

// --- Component: SignatureKpiSummary (3-column stats) ---
const SignatureKpiSummary: React.FC = () => (
    <SignatureWrapper>
        <div className="flex gap-2 w-full h-full py-1 px-1 text-center">
            {[
                { label: 'OEE', val: '76%', color: 'text-brand' },
                { label: 'QTY', val: '1.2k', color: 'text-success' },
                { label: 'DHU', val: '1.8%', color: 'text-error' }
            ].map((kpi, i) => (
                <div key={i} className="flex-1 bg-surface-subtle/30 rounded py-2 px-0.5 flex flex-col justify-center border border-border/50">
                    <span className={`text-[12px] font-black ${kpi.color}`}>{kpi.val}</span>
                    <span className="text-[5px] text-text-muted font-bold uppercase">{kpi.label}</span>
                </div>
            ))}
        </div>
    </SignatureWrapper>
);

// --- Component: SignatureBlockers (Badges) ---
const SignatureBlockers: React.FC = () => (
    <SignatureWrapper>
        <div className="flex flex-wrap gap-1 items-center justify-center h-full px-1">
            <span className="text-[7px] bg-error/10 text-error px-1 py-0.5 rounded font-black border border-error/20">NEEDLE</span>
            <span className="text-[7px] bg-warning/10 text-warning px-1 py-0.5 rounded font-black border border-warning/20">THREAD</span>
            <span className="text-[7px] bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded font-black border border-amber-500/20">MOTOR</span>
        </div>
    </SignatureWrapper>
);

// --- Main Export ---
export const MicroPreview: React.FC<MicroPreviewProps> = ({ widgetId, sampleData, isSupported }) => {
    if (!isSupported) return null;

    // Helper: Extract a numeric series for visualizations, with fallback to common fields
    const getBestSeries = (primaryField: string, type: 'production' | 'quality' | 'efficiency' = 'efficiency') => {
        const raw = sampleData[primaryField] || [];
        if (raw.length === 0) {
            // Fake data fallbacks with realistic patterns
            if (type === 'production') {
                // 12 points with "Noontime Dip" at index 4 & 5
                return [30, 45, 60, 55, 25, 20, 50, 65, 75, 80, 70, 65];
            }
            if (type === 'quality') {
                // Volatile quality data with spikes
                return [1.2, 1.5, 3.2, 2.1, 1.8, 1.4, 2.8, 3.5, 2.0, 1.7, 1.5, 1.3];
            }
            // Generic growth/oscillation for efficiency
            return [70, 72, 75, 74, 78, 82, 85, 84, 86, 88, 87, 89];
        }
        return raw.map(v => (typeof v === 'number' ? v : parseFloat(String(v)) || 0)).slice(-12);
    };

    const actuals = getBestSeries('actual_qty', 'production');
    const targets = getBestSeries('planned_qty', 'production');
    const dhu = getBestSeries('dhu', 'quality');
    const efficiency = getBestSeries('line_efficiency', 'efficiency');
    const effVal = efficiency[efficiency.length - 1] || 78;

    switch (widgetId) {
        // --- PRODUCTION ---
        case 'production-chart':
        case 'target-realization':
            return <SignatureProduction actual={actuals} target={targets} />;

        case 'sam-performance':
            return <SignatureSAM actual={actuals.slice(0, 6)} standard={targets.slice(0, 6)} />;

        case 'earned-minutes':
            return <SignatureEarnedMinutes />;

        // --- EFFICIENCY & OEE ---
        case 'line-efficiency':
            return <SignatureEfficiency value={effVal} />;

        // --- QUALITY ---
        case 'dhu-quality':
            return <SignatureQuality data={dhu} />;

        case 'speed-quality':
            return <SignatureSpeedQuality efficiency={efficiency} dhu={dhu} />;

        // --- OPERATIONS & PROGRESS ---
        case 'production-timeline':
        case 'style-progress':
        case 'complexity-impact':
            return <SignatureStyleProgress />;

        case 'blocker-cloud':
            return <SignatureBlockers />;

        case 'workforce-attendance':
            return <SignatureWorkforce />;

        case 'kpi-summary':
            return <SignatureKpiSummary />;

        default:
            return <SignatureProduction actual={[30, 40, 35, 45]} target={[40, 40, 40, 40]} />;
    }
};

