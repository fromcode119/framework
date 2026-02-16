'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { FrameworkIcons } from '@/lib/icons';
import { useTheme } from '@/components/theme-context';
import { useNotify } from '@/components/notification-context';
import { useAuth } from '@/components/auth-context';
import { api } from '@/lib/api';

const PublisherPortal = () => {
    const { theme } = useTheme();
    const { notify } = useNotify();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [submissionType, setSubmissionType] = useState<'plugin' | 'theme'>('plugin');
    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        version: '1.0.0',
        description: '',
        category: 'general',
        downloadUrl: '',
        iconUrl: '',
        capabilities: '',
        author: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const rawUrl = process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'https://marketplace.fromcode.com';
            const MARKETPLACE_URL = rawUrl.replace('/marketplace.json', '').replace('/registry.json', '');
            const submitUrl = `${MARKETPLACE_URL}/submit`;
            
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
            setFormData({
                name: '',
                slug: '',
                version: '1.0.0',
                description: '',
                category: 'general',
                downloadUrl: '',
                iconUrl: '',
                capabilities: '',
                author: ''
            });

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

            <div className="flex gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
                <button 
                    onClick={() => setSubmissionType('plugin')}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${submissionType === 'plugin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Plugins
                </button>
                <button 
                    onClick={() => setSubmissionType('theme')}
                    className={`px-6 py-3 rounded-xl font-semibold transition-all ${submissionType === 'theme' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    Themes
                </button>
            </div>

            <Card className={`p-10 border-0 shadow-2xl ${theme === 'dark' ? 'bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-slate-200'}`}>
                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Plugin Name</label>
                            <input 
                                type="text" 
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className={`w-full h-14 px-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}
                                placeholder="My Awesome Plugin"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Identifier (Slug)</label>
                            <input 
                                type="text" 
                                required
                                value={formData.slug}
                                onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                className={`w-full h-14 px-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}
                                placeholder="my-awesome-plugin"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Description</label>
                        <textarea 
                            required
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className={`w-full p-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 min-h-[120px] ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}
                            placeholder="What does your plugin do?"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <label className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Version</label>
                            <input 
                                type="text" 
                                value={formData.version}
                                onChange={e => setFormData({ ...formData, version: e.target.value })}
                                className={`w-full h-14 px-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Category</label>
                            <select 
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className={`w-full h-14 px-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}
                            >
                                <option value="general">General</option>
                                <option value="business">Business</option>
                                <option value="marketing">Marketing</option>
                                <option value="productivity">Productivity</option>
                                <option value="testing">Testing</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {submissionType === 'plugin' ? (
                            <div className="space-y-2">
                                <label className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Capabilities (Comma Separated)</label>
                                <input 
                                    type="text" 
                                    value={formData.capabilities}
                                    onChange={e => setFormData({ ...formData, capabilities: e.target.value })}
                                    className={`w-full h-14 px-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}
                                    placeholder="api, database, hooks, content"
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <label className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Author Name</label>
                                <input 
                                    type="text" 
                                    value={formData.author}
                                    onChange={e => setFormData({ ...formData, author: e.target.value })}
                                    className={`w-full h-14 px-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}
                                    placeholder="Your Name or Team"
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Icon / Preview URL (Optional)</label>
                            <input 
                                type="text" 
                                value={formData.iconUrl}
                                onChange={e => setFormData({ ...formData, iconUrl: e.target.value })}
                                className={`w-full h-14 px-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}
                                placeholder="https://lucide.dev/icons/puzzle.svg"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className={`text-[10px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Download URL (ZIP Archive)</label>
                        <input 
                            type="url" 
                            required
                            value={formData.downloadUrl}
                            onChange={e => setFormData({ ...formData, downloadUrl: e.target.value })}
                            className={`w-full h-14 px-5 rounded-2xl border-0 ring-1 font-semibold text-sm transition-all focus:ring-2 focus:ring-indigo-500 ${theme === 'dark' ? 'bg-slate-800 ring-white/10 text-white' : 'bg-slate-50 ring-slate-200 text-slate-900'}`}
                            placeholder="https://github.com/user/repo/releases/download/v1/plugin.zip"
                        />
                    </div>

                    <button 
                        type="submit"
                        disabled={loading}
                        className={`w-full h-16 rounded-[1.5rem] bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-wide shadow-2xl shadow-indigo-600/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-50`}
                    >
                        {loading ? (
                            <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <FrameworkIcons.Plus size={20} />
                                <span>Submit Plugin to Review</span>
                            </>
                        )}
                    </button>
                </form>
            </Card>
        </div>
    );
};

export default PublisherPortal;
