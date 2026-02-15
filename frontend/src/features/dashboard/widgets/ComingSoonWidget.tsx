import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WidgetWrapper } from '@/features/dashboard/components/WidgetWrapper';
import { getDensity } from '@/features/dashboard/components/WidgetWrapper';
import type { WidgetProps } from '../config';

interface ComingSoonWidgetProps extends WidgetProps {
    title?: string;
    description?: string;
}

export const ComingSoonWidget: React.FC<ComingSoonWidgetProps> = ({
    w, h, settings, demoData, title: propTitle, description: propDescription
}) => {
    const { t } = useTranslation();
    const density = getDensity(w, h);
    const title = propTitle || settings?.customTitle || t('widgets.coming_soon.title');
    const description = propDescription || t('widgets.coming_soon.description');

    return (
        <WidgetWrapper
            title={title}
            icon={<Lock className="w-full h-full text-text-muted" />}
            iconBgColor="bg-surface-subtle"
            density={density}
            isMock={false}
        >
            <div className="h-full w-full flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-surface-subtle p-3 rounded-full mb-3">
                    <Lock className="w-6 h-6 text-text-muted" />
                </div>
                <h3 className="font-semibold text-text-main mb-1">{t('widgets.coming_soon.title')}</h3>
                <p className="text-xs text-text-muted max-w-[200px]">
                    {t(description as any) || description}
                </p>
                {demoData && (
                    <div className="mt-2 text-[10px] text-text-subtle uppercase tracking-wider">
                        {t('widgets.coming_soon.locked')}
                    </div>
                )}
            </div>
        </WidgetWrapper>
    );
};

export default ComingSoonWidget;
