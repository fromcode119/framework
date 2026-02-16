"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/theme-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons } from '@/lib/icons';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export default function NewRolePage() {
  const { theme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    slug: '',
    name: '',
    description: '',
    type: 'custom',
    permissions: [] as string[]
  });

  useEffect(() => {
    async function loadPermissions() {
      try {
        const data = await api.get(ENDPOINTS.SYSTEM.PERMISSIONS);
        setPermissions(data || []);
      } catch (e) {
        console.error("Failed to load permissions", e);
      }
    }
    loadPermissions();
  }, []);

  const togglePermission = (perm: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(ENDPOINTS.SYSTEM.ROLES, formData);
      router.push('/users/roles');
    } catch (e) {
      console.error("Failed to save role", e);
    } finally {
      setLoading(false);
    }
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
              <FrameworkIcons.Left size={20} strokeWidth={2} />
            </Button>
            <div>
              <h1 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Create New Role
              </h1>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                Define sets of permissions to assign to your users.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-6 lg:px-12 py-12">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <Card title="Role Details">
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input 
                    label="Name" 
                    placeholder="e.g. Editor" 
                    value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      const slug = val.toLowerCase().replace(/[^a-z0-9]/g, '-');
                      setFormData(prev => ({ ...prev, name: val, slug: prev.slug === '' || prev.slug === val.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, -1) ? slug : prev.slug }));
                    }}
                    required
                    className="h-11 rounded-xl font-semibold"
                  />
                  <Input 
                    label="Slug (System ID)" 
                    placeholder="e.g. editor" 
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    required
                    className="h-11 rounded-xl font-semibold"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-tight text-slate-400 pl-1">Description</label>
                  <textarea 
                    className={`w-full h-32 rounded-2xl p-6 border outline-none transition-all text-sm font-semibold tracking-tight ${
                      theme === 'dark' ? 'bg-slate-950/50 border-slate-800 text-white focus:border-indigo-500 shadow-2xl shadow-black/40' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-xl shadow-slate-200/50'
                    }`}
                    placeholder="Optional description of what this role allows..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
            </Card>

            <Card title="Permissions">
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Available Options</span>
                  <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">{formData.permissions.length} Selected</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {permissions.map(perm => (
                    <div 
                      key={perm.name}
                      onClick={() => togglePermission(perm.name)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all duration-300 flex items-center justify-between group ${
                        formData.permissions.includes(perm.name)
                          ? (theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500/40' : 'bg-indigo-50 border-indigo-200 shadow-md')
                          : (theme === 'dark' ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200')
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-xs font-bold tracking-tight ${formData.permissions.includes(perm.name) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                          {perm.name}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight opacity-60">
                          {perm.group || 'General'}
                        </span>
                      </div>
                      <div className={`h-6 w-6 rounded-lg border flex items-center justify-center transition-all ${
                         formData.permissions.includes(perm.name)
                           ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                           : 'bg-transparent border-slate-200 dark:border-slate-800'
                      }`}>
                         {formData.permissions.includes(perm.name) && <FrameworkIcons.Check size={14} strokeWidth={3} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <Card title="Summary">
              <div className="space-y-6">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 space-y-4">
                   <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Role Type</span>
                      <Badge variant="amber" className="tracking-tight font-bold">Custom</Badge>
                   </div>
                   <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Selected Scope</span>
                      <span className="text-xs font-bold tracking-tight text-slate-600 dark:text-slate-300">
                        {formData.permissions.length === 0 ? 'No permissions' : `${formData.permissions.length} actions selected`}
                      </span>
                   </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    type="submit"
                    className="w-full h-12 text-xs font-bold uppercase tracking-tight rounded-xl shadow-xl shadow-indigo-600/20 text-white"
                    isLoading={loading}
                    icon={<FrameworkIcons.Check size={18} />}
                  >
                    Save Role
                  </Button>
                  <Button 
                    variant="ghost"
                    className="w-full h-12 text-xs font-bold tracking-tight text-slate-400 uppercase"
                    onClick={() => router.push('/users/roles')}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>

            <Card title="Help">
               <p className="text-xs text-slate-500 leading-relaxed font-bold tracking-tight opacity-70">
                 Creating this role will allow you to assign these specific permissions to any user in the system.
               </p>
            </Card>
          </div>
        </form>
      </div>
    </div>
  );
}
