import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { AXIOS_INSTANCE as axiosClient } from '../../../api/axios-client';
import { AxiosError } from 'axios';
import { Check, Copy } from "lucide-react";

interface WaitlistResponse {
    id: number;
    email: string;
    referral_code: string;
    created_at: string;
}

export const WaitlistForm = () => {
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
                    setErrorMessage("This email is already on the list!");
                } else {
                    setErrorMessage(error.response.data.detail || "Something went wrong. Please try again.");
                }
            } else {
                setErrorMessage("Network error. Please try again.");
            }
        }
    };

    const shareUrl = `https://linesight.ai?ref=${referralCode}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (status === "success") {
        return (
            <div className="flex flex-col items-center justify-center p-6 space-y-6 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>

                <div className="space-y-2">
                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">You're on the list!</h3>
                    <p className="text-slate-500 dark:text-slate-400">
                        We'll keep you posted at <span className="font-semibold text-slate-900 dark:text-slate-200">{email}</span>.
                    </p>
                </div>

                {/* The Viral Loop Card */}
                <div className="w-full max-w-sm bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3 shadow-sm">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Boost your position by sharing:</p>

                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-slate-400 truncate select-all font-mono">
                            {shareUrl}
                        </code>
                        <button
                            onClick={handleCopy}
                            className="p-2.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm"
                            title="Copy link"
                        >
                            {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-slate-500 dark:text-slate-400" />}
                        </button>
                    </div>
                </div>

                <button
                    onClick={() => window.open(`https://twitter.com/intent/tweet?text=Just%20joined%20the%20waitlist%20for%20Linesight.%20Check%20it%20out!%20${encodeURIComponent(shareUrl)}`, '_blank')}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                    Share on X (Twitter)
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <Input
                    type="email"
                    placeholder="name@company.com"
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
                    {status === "loading" ? "Joining..." : "Join Waitlist"}
                </Button>
            </form>
            {status === "error" && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400 animate-in slide-in-from-top-1">
                    {errorMessage}
                </p>
            )}
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                Get early access before we launch publicly.
            </p>
        </div>
    );
};
