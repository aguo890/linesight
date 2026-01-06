import {
    Activity,
    BarChart2,
    BarChart3,
    Box,
    CheckCircle2,
    Clock,
    Factory,
    Gauge,
    LayoutDashboard,
    LineChart,
    PieChart,
    ShieldCheck,
    AlertTriangle,
    Users,
    Zap,
    TrendingUp,
    Search,
    AlertOctagon
} from 'lucide-react';
import React from 'react';

export const ICON_MAP: Record<string, React.ElementType> = {
    'Activity': Activity,
    'BarChart2': BarChart2,
    'BarChart3': BarChart3,
    'Box': Box,
    'CheckCircle2': CheckCircle2,
    'Clock': Clock,
    'Factory': Factory,
    'Gauge': Gauge,
    'LayoutDashboard': LayoutDashboard,
    'LineChart': LineChart,
    'PieChart': PieChart,
    'ShieldCheck': ShieldCheck,
    'AlertTriangle': AlertTriangle,
    'Users': Users,
    'Zap': Zap,
    'TrendingUp': TrendingUp,
    'Search': Search,
    'AlertOctagon': AlertOctagon
};

export const getWidgetIcon = (iconName: string): React.ElementType => {
    return ICON_MAP[iconName] || Box; // Fallback to Box
};
