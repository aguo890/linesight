
import React from 'react';
import { Lock } from 'lucide-react';
import { WidgetWrapper } from '../components/WidgetWrapper';
import { getDensity } from '../components/WidgetWrapper';
import type { WidgetProps } from '../config';

interface ComingSoonWidgetProps extends WidgetProps {
    title?: string;
    description?: string;
}

export const ComingSoonWidget: React.FC<ComingSoonWidgetProps> = ({
    w, h, settings, demoData, title: propTitle, description: propDescription
}) => {
    const density = getDensity(w, h);
    const title = propTitle || settings?.customTitle || 'Coming Soon';
    const description = propDescription || 'This widget relies on live production data which is currently being implemented.';

    return (
        <WidgetWrapper
            title={title}
            icon={<Lock className="w-full h-full text-gray-400" />}
            iconBgColor="bg-gray-100"
            density={density}
            isMock={false}
        >
            <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-gray-100 p-3 rounded-full mb-3">
                    <Lock className="w-6 h-6 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-700 mb-1">Coming Soon</h3>
                <p className="text-xs text-gray-500 max-w-[200px]">
                    {description}
                </p>
                {demoData && (
                    <div className="mt-2 text-[10px] text-gray-300 uppercase tracking-wider">
                        Locked
                    </div>
                )}
            </div>
        </WidgetWrapper>
    );
};

export default ComingSoonWidget;
