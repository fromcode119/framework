"use client";

import React, { useState } from 'react';
import { ThemeHooks } from '@/components/use-theme';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@/lib/icons';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export default function NewPermissionPage() {
  const { theme } = ThemeHooks.useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    group: 'Structure',
    impact: 'Medium',
    pluginSlug: 'System'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.PERMISSIONS, formData);
      router.push('/users/permissions');
    } catch (e) {
      console.error("Failed to save permission", e);
    } finally {
      setLoading(false);
    }
  };

  const impactColors = {
    'Low': 'bg-emerald-500',
    'Medium': 'bg-indigo-500',
    'High': 'bg-amber-500',
    'Critical': 'bg-rose-500'
  };

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => router.back()}
              className="h-12 w-12 rounded-2xl border border-slate-200 dark:border-slate-800"
            >
              <FrameworkIcons.Left size={20} />
            </Button>
            <div>
              <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Register Capability
              </h1>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                Define a new atomic permission hook for the system registry.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-6 lg:px-12 py-12">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <Card title="Capability Definition">
              <div className="space-y-6">
                <Input 
                  label="Permission Identifier" 
                  placeholder="e.g. storage:archive" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9:]/g, '-') }))}
                  required
                  className="h-11 rounded-xl font-semibold"
                />
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-tight text-slate-400 pl-1">Functional Description</label>
                  <textarea 
                    className={`w-full h-32 rounded-2xl p-6 border outline-none transition-all text-sm font-semibold tracking-tight ${
                      theme === 'dark' ? 'bg-slate-950/50 border-slate-800 text-white focus:border-indigo-500 shadow-2xl shadow-black/40' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-xl shadow-slate-200/50'
                    }`}
                    placeholder="What does this capability allow a user to perform?"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input 
                    label="Domain Group" 
                    placeholder="e.g. Content, Security, Media" 
                    value={formData.group}
                    onChange={(e) => setFormData(prev => ({ ...prev, group: e.target.value }))}
                    className="h-11 rounded-xl font-semibold"
                  />
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-tight text-slate-400 pl-1">Security Impact</label>
                    <div className="flex gap-2">
                      {['Low', 'Medium', 'High', 'Critical'].map(lvl => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, impact: lvl }))}
                          className={`flex-1 h-11 rounded-xl border text-[10px] font-bold uppercase tracking-tight transition-all ${
                            formData.impact === lvl
                              ? (theme === 'dark' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400 shadow-lg shadow-indigo-500/10' : 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20')
                              : (theme === 'dark' ? 'bg-slate-900/60 border-slate-800 text-slate-500 hover:border-indigo-500/30' : 'bg-white border-slate-200 text-slate-400 hover:border-indigo-300')
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <Card title="Registry Summary">
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
                   <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Source Entity</span>
                      <Badge variant="purple" className="tracking-tight font-bold">System Core</Badge>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Blast Radius</span>
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${(impactColors as any)[formData.impact]}`} />
                        <span className="text-[10px] font-bold uppercase tracking-tight text-slate-600 dark:text-slate-300">{formData.impact}</span>
                      </div>
                   </div>
                </div>

                <Button 
                  type="submit"
                  className="w-full h-14 text-sm font-bold rounded-2xl shadow-2xl shadow-indigo-600/20 uppercase tracking-tight"
                  isLoading={loading}
                  icon={<FrameworkIcons.Check size={18} />}
                >
                  Publish Capability
                </Button>
              </div>
            </Card>

            <Card title="Behavioral Auditing">
               <p className="text-xs text-slate-500 leading-relaxed font-bold tracking-tight">
                 Newly defined permissions must be matched by identical identifier logic in the underlying plugin or kernel hooks to be enforceable.
               </p>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}
