'use client';

import React, { useState } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { NotificationHooks } from '@/components/use-notification';
import { AuthHooks } from '@/components/use-auth';
import { MarketplacePublisherConstants } from '@/lib/marketplace-publisher-constants';
import { MarketplaceUrlService } from '@fromcode119/marketplace-client';
import { PublisherPortalConstants } from './publisher-portal-constants';
import { PublisherTypeTabs } from './publisher-type-tabs';
import { PublisherForm } from './publisher-form';

export default function PublisherPortal() {
    const { theme } = ThemeHooks.useTheme();
    const { notify } = NotificationHooks.useNotify();
    const { user } = AuthHooks.useAuth();
    const [loading, setLoading] = useState(false);
    const [submissionType, setSubmissionType] = useState<'plugin' | 'theme'>('plugin');
    const [formData, setFormData] = useState({ ...PublisherPortalConstants.EMPTY_PUBLISHER_FORM });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const marketplaceApiUrl = MarketplaceUrlService.resolveApiBaseUrl(process.env.NEXT_PUBLIC_MARKETPLACE_URL);
            const submitUrl = `${marketplaceApiUrl}${MarketplacePublisherConstants.SUBMIT_PATH}`;

            const formattedData = {
                ...formData,
                capabilities: submissionType === 'plugin' ? formData.capabilities.split(',').map(c => c.trim()).filter(Boolean) : undefined,
                author: submissionType === 'theme' ? (formData.author || user?.email || 'Anonymous') : undefined
            };

            await fetch(submitUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plugin: formattedData,
                    publisher: user?.id || 'anonymous',
                    type: submissionType
                })
            });

            notify('success', 'Submission Sent', `Your ${submissionType} has been submitted for review.`);
            setFormData({ ...PublisherPortalConstants.EMPTY_PUBLISHER_FORM });

            setTimeout(() => {
                window.location.reload();
            }, 2000);
        } catch (err: any) {
            notify('error', 'Submission Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="flex flex-col gap-2">
                <h1 className={`text-4xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                    Developer Portal
                </h1>
                <p className={`text-lg font-medium ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    Submit and manage your plugins and themes on the Fromcode Marketplace.
                </p>
            </div>

            <PublisherTypeTabs theme={theme} submissionType={submissionType} onSelect={setSubmissionType} />

            <PublisherForm
                theme={theme}
                submissionType={submissionType}
                formData={formData}
                loading={loading}
                onChange={setFormData}
                onSubmit={handleSubmit}
            />
        </div>
    );
}
