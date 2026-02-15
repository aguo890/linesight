/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        supportedLngs: ['en', 'es', 'ar', 'zh', 'fr', 'de', 'ja', 'pt', 'hi', 'bn', 'vi', 'tr', 'it', 'ur', 'ko', 'ru', 'nl'],

        interpolation: {
            escapeValue: false,
        },

        backend: {
            loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}/{{ns}}.json`.replace(/\/+/g, '/'),
        },
    });

export default i18n;
