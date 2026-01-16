import React from 'react';
import { Save } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { getWidgetManifest } from '../registry';
import { RightSidebarShell } from './RightSidebarShell';

export const SettingsSidebar: React.FC = () => {
    const { editingWidgetId, activePanel, closePanels, widgets, updateWidgetSettings } = useDashboard();

    const isOpen = activePanel === 'settings' && !!editingWidgetId;
    const widget = widgets.find(w => w.i === editingWidgetId);
    const manifest = widget ? getWidgetManifest(widget.widget) : null;

    const schemaShape = (manifest?.settingsSchema as any)?.shape || {};
    const currentSettings = widget?.settings || {};

    return (
        <RightSidebarShell
            isOpen={isOpen}
            onClose={closePanels}
            title="Widget Settings"
            subtitle={manifest?.meta?.title}
            footer={
                <button
                    onClick={closePanels}
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm tracking-widest hover:bg-slate-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <Save size={16} /> SAVE CHANGES
                </button>
            }
        >
            <div className="p-6 space-y-8">
                {Object.keys(schemaShape).map((key) => {
                    const fieldSchema = schemaShape[key];
                    const currentValue = currentSettings[key] ?? fieldSchema._def.defaultValue?.();

                    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                    return (
                        <div key={key} className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {label}
                            </label>

                            {fieldSchema._def.typeName === 'ZodBoolean' ? (
                                <button
                                    onClick={() => widget && updateWidgetSettings(widget.i, { [key]: !currentValue })}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${currentValue ? 'bg-blue-600' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${currentValue ? 'start-7' : 'start-1'}`} />
                                </button>
                            ) :
                                fieldSchema._def.typeName === 'ZodNumber' ? (
                                    <input
                                        type="number"
                                        value={currentValue ?? ''}
                                        onChange={(e) => widget && updateWidgetSettings(widget.i, { [key]: Number(e.target.value) })}
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                ) :
                                    (
                                        <input
                                            type="text"
                                            value={currentValue ?? ''}
                                            onChange={(e) => widget && updateWidgetSettings(widget.i, { [key]: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    )}
                        </div>
                    );
                })}
            </div>
        </RightSidebarShell>
    );
};
