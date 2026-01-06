import React from 'react';
import { X, Table as TableIcon } from 'lucide-react';

interface DataPreviewModalProps {
    importId: string;
    filename: string;
    onClose: () => void;
    data: Record<string, any>[];
}

export const DataPreviewModal: React.FC<DataPreviewModalProps> = ({ filename, onClose, data }) => {
    if (!data || data.length === 0) return null;

    // Get headers from the first record (limit to first 10 columns)
    const headers = Object.keys(data[0]).slice(0, 10);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <TableIcon className="text-sky-400 h-5 w-5" />
                        <div>
                            <h3 className="font-semibold text-slate-100">Data Preview</h3>
                            <p className="text-xs text-slate-400">{filename} (First 10 columns shown)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="overflow-auto p-4">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-800/50">
                                {headers.map(header => (
                                    <th key={header} className="px-3 py-2 text-left text-xs font-mono text-sky-400 border border-slate-700 whitespace-nowrap">
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-800/30">
                                    {headers.map(header => (
                                        <td key={header} className="px-3 py-2 text-xs text-slate-300 border border-slate-700 whitespace-nowrap">
                                            {row[header]?.toString() || ''}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="p-3 bg-slate-800/20 text-[10px] text-slate-500 italic">
                    Showing first 10 rows of internal staging data for {filename}.
                </div>
            </div>
        </div>
    );
};
