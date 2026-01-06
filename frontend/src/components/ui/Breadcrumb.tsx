/**
 * Breadcrumb Navigation Component
 * 
 * Displays a hierarchical navigation trail (e.g., Workspace > Factory > Line).
 * Each segment except the last is clickable for navigation.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbProps {
    items: BreadcrumbItem[];
    className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
    return (
        <nav aria-label="Breadcrumb" className={`flex items-center text-sm ${className}`}>
            <ol className="flex items-center">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;

                    return (
                        <li key={`${item.label}-${index}`} className="flex items-center">
                            {index > 0 && (
                                <ChevronRight className="h-4 w-4 text-gray-400 mx-2 flex-shrink-0" />
                            )}

                            {isLast ? (
                                <span
                                    className="font-semibold text-gray-900 truncate max-w-[200px] md:max-w-none"
                                    aria-current="page"
                                >
                                    {item.label}
                                </span>
                            ) : (
                                <Link
                                    to={item.href || '#'}
                                    className="text-gray-500 hover:text-indigo-600 transition-colors duration-200"
                                >
                                    {item.label}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumb;
