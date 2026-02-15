/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Interface for the structured schema error data
 */
export interface SchemaErrorDetails {
    missing_columns: string[];
    extra_columns: string[];
    expected_columns: string[];
    found_columns: string[];
    message?: string;
}

interface ValidationErrorDisplayProps {
    errorDetails: SchemaErrorDetails;
}

/**
 * Helper component for individual column lists
 */
const ColumnList: React.FC<{
    title: string;
    items: string[];
    colorClass: string;
}> = ({ title, items, colorClass }) => {
    if (!items || items.length === 0) return null;

    return (
        <div className="flex flex-col gap-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
                {title}
            </span>
            <ul className="space-y-1">
                {items.map((col) => (
                    <li key={col} className="flex items-center gap-2 text-sm text-text-main/80">
                        <div className={`w-1 h-1 rounded-full ${colorClass.replace('text-', 'bg-')}`} />
                        <span className="font-mono text-[11px]">{col}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export const ValidationErrorDisplay: React.FC<ValidationErrorDisplayProps> = ({ errorDetails }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);

    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-error/5 border border-error/20 rounded-xl overflow-hidden"
        >
            <div className="p-4">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-error/10 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-error" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-error mb-1">
                            {errorDetails.message || "File structure mismatch"}
                        </h3>
                        <p className="text-xs text-text-muted mb-4 font-medium">
                            The uploaded file does not match the required data schema.
                        </p>

                        {/* Primary Diff View */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface/50 p-4 rounded-lg border border-border/50">
                            <ColumnList
                                title="Missing Columns (Required)"
                                items={errorDetails.missing_columns}
                                colorClass="text-error"
                            />
                            <ColumnList
                                title="Extra Columns (Ignored)"
                                items={errorDetails.extra_columns}
                                colorClass="text-warning"
                            />
                        </div>

                        {/* Progressive Disclosure for Full Details */}
                        <div className="mt-4 border-t border-border/50 pt-3">
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-text-main transition-colors"
                            >
                                View full schema comparison
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>

                            {isExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    className="mt-4 grid grid-cols-2 gap-6 bg-surface-subtle/50 p-4 rounded-lg"
                                >
                                    <ColumnList
                                        title="Expected Schema"
                                        items={errorDetails.expected_columns}
                                        colorClass="text-text-muted"
                                    />
                                    <ColumnList
                                        title="Your File"
                                        items={errorDetails.found_columns}
                                        colorClass="text-text-muted"
                                    />
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
