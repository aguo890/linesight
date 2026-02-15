/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-canvas flex relative overflow-hidden">
            {/* Sidebar Skeleton - Mirrors the real Sidebar's position automatically in RTL */}
            <aside className="hidden lg:flex w-64 flex-col gap-4 border-e border-border p-4 bg-surface/50">
                <div className="flex items-center gap-2 px-2 mb-6">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <Skeleton className="h-6 w-32" />
                </div>
                <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-10 w-full rounded-md" />
                    ))}
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Header Skeleton */}
                <header className="bg-surface border-b border-border px-6 py-4">
                    <div className="max-w-[1600px] mx-auto">
                        {/* Breadcrumb Placeholder */}
                        <div className="flex items-center gap-2 mb-4">
                            <Skeleton className="h-4 w-20" />
                            <span className="text-border">/</span>
                            <Skeleton className="h-4 w-32" />
                            <span className="text-border">/</span>
                            <Skeleton className="h-4 w-40" />
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="space-y-2">
                                {/* Live Monitor Tag */}
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-3 w-3 rounded-full" />
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                                {/* Title */}
                                <div className="flex items-center gap-3">
                                    <Skeleton className="h-8 w-64 rounded-lg" />
                                    <Skeleton className="h-6 w-24 rounded-md" />
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <Skeleton className="h-10 w-32 rounded-full" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Grid Skeleton */}
                <main className="flex-1 p-6 relative max-w-[1600px] mx-auto w-full">
                    <div className="grid grid-cols-12 gap-5 auto-rows-[100px]">
                        {/* Row 1 */}
                        <div className="col-span-12 md:col-span-8 row-span-3 bg-surface rounded-2xl border border-border p-4">
                            <div className="flex justify-between mb-4">
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-full w-full rounded-xl" />
                        </div>
                        <div className="col-span-12 md:col-span-4 row-span-3 bg-surface rounded-2xl border border-border p-4">
                            <div className="flex justify-between mb-4">
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-full w-full rounded-xl" />
                        </div>

                        {/* Row 2 */}
                        <div className="col-span-12 md:col-span-4 row-span-2 bg-surface rounded-2xl border border-border p-4">
                            <div className="flex justify-between mb-4">
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-full w-full rounded-xl" />
                        </div>
                        <div className="col-span-12 md:col-span-4 row-span-2 bg-surface rounded-2xl border border-border p-4">
                            <div className="flex justify-between mb-4">
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-full w-full rounded-xl" />
                        </div>
                        <div className="col-span-12 md:col-span-4 row-span-2 bg-surface rounded-2xl border border-border p-4">
                            <div className="flex justify-between mb-4">
                                <Skeleton className="h-4 w-32" />
                            </div>
                            <Skeleton className="h-full w-full rounded-xl" />
                        </div>
                    </div>
                </main>
            </div> {/* End Main Content Wrapper */}
        </div>
    );
};
