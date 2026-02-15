/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import 'react-grid-layout';

declare module 'react-grid-layout' {
    export interface ResponsiveProps {
        isRTL?: boolean;
        resizeHandles?: ('s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne')[];
    }
}
