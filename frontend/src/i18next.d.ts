import 'i18next';
import en from '../public/locales/en/translation.json';
import landing from '../public/locales/en/landing.json';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'translation';
        resources: {
            translation: typeof en;
            landing: typeof landing;
        };
    }
}
