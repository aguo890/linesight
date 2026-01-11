import { useScroll, MotionValue } from 'framer-motion';
import { RefObject } from 'react';

export const useSnakeScroll = (ref: RefObject<HTMLElement>): MotionValue<number> => {
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
