/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

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
