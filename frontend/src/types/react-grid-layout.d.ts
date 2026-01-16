import 'react-grid-layout';

declare module 'react-grid-layout' {
    export interface ResponsiveProps {
        isRTL?: boolean;
        resizeHandles?: ('s' | 'w' | 'e' | 'n' | 'sw' | 'nw' | 'se' | 'ne')[];
    }
}
