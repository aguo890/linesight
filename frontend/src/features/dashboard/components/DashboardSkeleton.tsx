import React from 'react';
import { Skeleton } from '../../../components/ui/Skeleton';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-canvas flex flex-col relative overflow-hidden">
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
        </div>
    );
};
