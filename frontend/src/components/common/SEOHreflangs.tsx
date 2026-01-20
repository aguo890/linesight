import { useEffect } from 'react';
import { LOCALES } from '../../context/config/locales';

interface SEOHreflangsProps {
    /** The generic path without locale prefix (e.g., "/" or "/pricing") */
    currentPath: string;
    /** Optional base domain - defaults to production URL */
    domain?: string;
}

/**
 * SEOHreflangs - Injects hreflang link tags for multi-language SEO
 * 
 * Uses proper cleanup to prevent duplicate/zombie tags.
 * Each tag gets a unique data-hreflang-managed attribute for safe removal.
 * 
 * Usage:
 * <SEOHreflangs currentPath="/" />
 * <SEOHreflangs currentPath="/pricing" />
 */
export function SEOHreflangs({ currentPath, domain = 'https://www.linesight.io' }: SEOHreflangsProps) {
    // Normalize path to ensure it starts with /
    const normalizedPath = currentPath.startsWith('/') ? currentPath : `/${currentPath}`;

    // Remove trailing slash except for root
    const cleanPath = normalizedPath === '/' ? '' : normalizedPath.replace(/\/$/, '');

    useEffect(() => {
        const managedAttribute = 'data-hreflang-managed';
        const createdLinks: HTMLLinkElement[] = [];

        // Remove any existing managed hreflang tags (idempotent cleanup)
        document.querySelectorAll(`link[${managedAttribute}]`).forEach(el => el.remove());

        // Create x-default (fallback to English)
        const defaultLink = document.createElement('link');
        defaultLink.rel = 'alternate';
        defaultLink.hreflang = 'x-default';
        defaultLink.href = `${domain}/en${cleanPath}`;
        defaultLink.setAttribute(managedAttribute, 'true');
        document.head.appendChild(defaultLink);
        createdLinks.push(defaultLink);

        // Create hreflang for each supported locale
        Object.keys(LOCALES).forEach((code) => {
            const link = document.createElement('link');
            link.rel = 'alternate';
            link.hreflang = code;
            link.href = `${domain}/${code}${cleanPath}`;
            link.setAttribute(managedAttribute, 'true');
            document.head.appendChild(link);
            createdLinks.push(link);
        });

        // Cleanup on unmount - only removes our managed tags
        return () => {
            createdLinks.forEach(link => {
                if (link.parentNode) {
                    link.parentNode.removeChild(link);
                }
            });
        };
    }, [domain, cleanPath]);

    // This component only manages side effects, renders nothing
    return null;
}

export default SEOHreflangs;
