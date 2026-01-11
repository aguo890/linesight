export type ShortLocale = 'en' | 'es' | 'ar' | 'zh';
export type RegionLocale = 'en-US' | 'es-ES' | 'ar-EG' | 'zh-CN';

// Mapping from short codes (frontend) to region codes (backend)
const SHORT_TO_REGION: Record<ShortLocale, RegionLocale> = {
    'en': 'en-US',
    'es': 'es-ES',
    'ar': 'ar-EG',
    'zh': 'zh-CN',
};

// Mapping from region codes (backend) to short codes (frontend)
const REGION_TO_SHORT: Record<string, ShortLocale> = {
    'en-US': 'en',
    'es-ES': 'es',
    'ar-EG': 'ar',
    'zh-CN': 'zh',
    // Generic fallbacks
    'en': 'en',
    'es': 'es',
    'ar': 'ar',
    'zh': 'zh',
};

export const toRegionLocale = (short: string): string => {
    return SHORT_TO_REGION[short as ShortLocale] || 'en-US';
};

export const toShortLocale = (region: string): string => {
    return REGION_TO_SHORT[region] || 'en';
};
