import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { AXIOS_INSTANCE as axiosClient } from '../../../api/axios-client';
import { AxiosError } from 'axios';
import { Check, Copy, Linkedin, Mail } from "lucide-react";

interface WaitlistResponse {
    id: number;
    email: string;
    referral_code: string;
    created_at: string;
}

// X (Twitter) icon component
const XIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
);

export const WaitlistForm = () => {
    const { t } = useTranslation('landing');
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [referralCode, setReferralCode] = useState<string>("");
    const [copied, setCopied] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus("loading");
        setErrorMessage("");

        try {
            const response = await axiosClient.post<WaitlistResponse>('/api/v1/waitlist/', { email });
            setReferralCode(response.data.referral_code);
            setStatus("success");
        } catch (error) {
            setStatus("error");
            if (error instanceof AxiosError && error.response) {
                // If backend returns 409, it means already exists
                if (error.response.status === 409) {
                    setErrorMessage(t('waitlist.success.error_exists'));
                } else {
                    // Handle both string detail and Pydantic validation error array
                    const detail = error.response.data.detail;
                    let message: string;
                    if (Array.isArray(detail)) {
                        // Pydantic validation error: extract the message from the first error
                        message = detail[0]?.msg || "Validation error. Please check your input.";
                    } else if (typeof detail === 'string') {
                        message = detail;
                    } else {
                        message = t('waitlist.success.error_generic');
                    }
                    setErrorMessage(message);
                }
            } else {
                setErrorMessage(t('waitlist.success.error_generic'));
            }
        }
    };

    const shareUrl = `https://linesight.ai?ref=${referralCode}`;

    // Professional messaging for B2B audience
    const shareText = "I'm getting early access to Linesight — a new platform for real-time production line analytics. I have a few invitations available for industry colleagues.";
    const emailSubject = "Invitation: Early Access to Linesight Production Analytics";
    const emailBody = `Hi,\n\nI recently secured early access to Linesight, a new platform designed for real-time production line analytics and optimization.\n\nI have a limited number of invitations to share with industry colleagues who might benefit from this tool.\n\nYou can claim your invitation here:\n${shareUrl}\n\nBest regards`;

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const socialLinks = {
        x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
        linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
        email: `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`,
    };

    if (status === "success") {
        return (
            <div className="flex flex-col items-center justify-center p-6 space-y-6 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>

                <div className="space-y-2">
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('waitlist.success.title')}</h3>
                    <p className="text-slate-500 dark:text-slate-400">
                        {t('waitlist.success.subtitle')} <span className="font-semibold text-slate-900 dark:text-slate-200">{email}</span>.
                    </p>
                </div>

                {/* Professional Invitation Card */}
                <div className="w-full max-w-md bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/70 dark:to-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm">
                    <div className="space-y-1">
                        <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
                            {t('waitlist.success.vip_title')}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('waitlist.success.vip_desc')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-600 dark:text-slate-400 truncate select-all font-mono">
                            {shareUrl}
                        </code>
                        <button
                            onClick={handleCopy}
                            className="p-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-all border border-slate-200 dark:border-slate-600 hover:shadow-sm"
                            title="Copy invitation link"
                        >
                            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-slate-500 dark:text-slate-400" />}
                        </button>
                    </div>

                    {/* Social Share Buttons */}
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                            onClick={() => window.open(socialLinks.linkedin, '_blank')}
                            className="flex items-center gap-2 px-4 py-2 bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-medium rounded-lg transition-colors"
                            title="Share on LinkedIn"
                        >
                            <Linkedin size={16} />
                            <span>LinkedIn</span>
                        </button>
                        <button
                            onClick={() => window.open(socialLinks.x, '_blank')}
                            className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black text-sm font-medium rounded-lg transition-colors"
                            title="Share on X"
                        >
                            <XIcon size={14} />
                            <span>Post</span>
                        </button>
                        <button
                            onClick={() => window.location.href = socialLinks.email}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 dark:bg-slate-600 dark:hover:bg-slate-500 text-white text-sm font-medium rounded-lg transition-colors"
                            title="Send via Email"
                        >
                            <Mail size={16} />
                            <span>Email</span>
                        </button>
                    </div>
                </div>

                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm">
                    {t('waitlist.success.referral_note')}
                </p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <Input
                    type="email"
                    placeholder={t('waitlist.placeholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={status === "loading"}
                    className="h-12 text-base bg-white dark:bg-slate-900"
                />
                <Button
                    type="submit"
                    size="lg"
                    disabled={status === "loading"}
                    className="h-12 px-8 bg-black text-white hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200"
                >
                    {status === "loading" ? t('waitlist.cta_loading') : t('waitlist.cta')}
                </Button>
            </form>
            {status === "error" && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400 animate-in slide-in-from-top-1">
                    {errorMessage}
                </p>
            )}
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                {t('waitlist.helper')}
            </p>
        </div>
    );
};
