/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import { useScroll, MotionValue } from 'framer-motion';
import type { RefObject } from 'react';

export const useSnakeScroll = <T extends HTMLElement>(ref: RefObject<T | null>): MotionValue<number> => {
    const { scrollYProgress } = useScroll({
        target: ref,
        // OFFSET EXPLANATION:
        // "start end": When top of container hits bottom of viewport (Start animating)
        // "end start": When bottom of container hits top of viewport (End animating)
        // Adjusting to "start 80%" makes it start drawing a bit earlier
        offset: ["start 80%", "end 20%"]
    });

    return scrollYProgress;
};
