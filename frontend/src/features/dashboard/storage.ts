import type { SavedDashboard } from './types';
import { STORAGE_KEYS } from './types';
import { type DashboardWidgetConfig } from './config';

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
    { i: 'chart-1', widget: 'production-chart', x: 0, y: 0, w: 2, h: 2 },
    { i: 'upload-1', widget: 'excel-upload', x: 2, y: 0, w: 2, h: 1 },
    { i: 'efficiency-1', widget: 'line-efficiency', x: 2, y: 1, w: 1, h: 1 },
    { i: 'attendance-1', widget: 'workforce-attendance', x: 3, y: 1, w: 1, h: 1 },
    { i: 'timeline-1', widget: 'production-timeline', x: 0, y: 2, w: 2, h: 1 },
    { i: 'dhu-1', widget: 'dhu-quality', x: 2, y: 2, w: 1, h: 1 },
    { i: 'sam-1', widget: 'sam-performance', x: 3, y: 2, w: 1, h: 1 },
];

export const dashboardStorage = {
    getDashboards: (): SavedDashboard[] => {
        const stored = localStorage.getItem(STORAGE_KEYS.DASHBOARDS);
        if (!stored) {
            const defaultBoard: SavedDashboard = {
                id: 'default',
                name: 'Stupid Dashboard',
                widgets: DEFAULT_WIDGETS,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const boards = [defaultBoard];
            localStorage.setItem(STORAGE_KEYS.DASHBOARDS, JSON.stringify(boards));
            return boards;
        }

        // Check for and remove specific zombie dashboards that are persisting
        const boards = JSON.parse(stored);
        const zombieIds = [
            'd58caee2-9f56-422c-8f74-060f3e3f8693',
            'b38800eb-f5f0-4b63-9f01-8bb382130e2e'
        ];

        const validBoards = boards.filter((d: SavedDashboard) => !zombieIds.includes(d.id));

        if (validBoards.length !== boards.length) {
            console.log('[Fix] Removed persistent zombie dashboards:', zombieIds);
            localStorage.setItem(STORAGE_KEYS.DASHBOARDS, JSON.stringify(validBoards));
            return validBoards;
        }

        return boards;
    },

    saveDashboards: (dashboards: SavedDashboard[]) => {
        localStorage.setItem(STORAGE_KEYS.DASHBOARDS, JSON.stringify(dashboards));
        window.dispatchEvent(new Event('dashboards-updated'));
    },

    getActiveId: (): string => {
        return localStorage.getItem(STORAGE_KEYS.ACTIVE_ID) || 'default';
    },

    setActiveId: (id: string) => {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
    },

    createDashboard: (name: string, initialWidgets?: DashboardWidgetConfig[]): SavedDashboard => {
        const dashboards = dashboardStorage.getDashboards();
        const newBoard: SavedDashboard = {
            id: crypto.randomUUID(),
            name,
            widgets: initialWidgets || DEFAULT_WIDGETS,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        dashboards.push(newBoard);
        dashboardStorage.saveDashboards(dashboards);
        return newBoard;
    },

    updateDashboardWidgets: (id: string, widgets: DashboardWidgetConfig[]) => {
        const dashboards = dashboardStorage.getDashboards();
        const index = dashboards.findIndex(d => d.id === id);
        if (index !== -1) {
            dashboards[index].widgets = widgets;
            dashboards[index].updatedAt = new Date().toISOString();
            dashboardStorage.saveDashboards(dashboards);
        }
    },

    deleteDashboard: (id: string) => {
        const dashboards = dashboardStorage.getDashboards();
        const filtered = dashboards.filter(d => d.id !== id);
        if (filtered.length !== dashboards.length) {
            dashboardStorage.saveDashboards(filtered);
            // If active dashboard was deleted, switch to default
            if (dashboardStorage.getActiveId() === id) {
                dashboardStorage.setActiveId('default');
            }
        }
    }
};
