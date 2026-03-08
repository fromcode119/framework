"use client";

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/components/theme-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function NewUserPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    accountStatus: 'active',
    forcePasswordReset: false,
    password: '',
    confirmPassword: '',
    roles: [] as string[]
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function loadRoles() {
      try {
        const response = await api.get(ENDPOINTS.SYSTEM.ROLES);
        if (!active) return;
        setRoles(Array.isArray(response) ? response : []);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load roles:', err);
        setErrors((prev) => ({
          ...prev,
          roles: 'Failed to load roles'
        }));
      } finally {
        if (active) setLoadingRoles(false);
      }
    }

    loadRoles();
    return () => {
      active = false;
    };
  }, []);

  const toggleRole = (slug: string) => {
    setFormData((prev) => ({
      ...prev,
      roles: prev.roles.includes(slug)
        ? prev.roles.filter((role) => role !== slug)
        : [...prev.roles, slug]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    if (!formData.password) {
      setErrors({ password: 'Password is required' });
      setSaving(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      setSaving(false);
      return;
    }

    try {
      await api.post(ENDPOINTS.SYSTEM.USERS, formData);
      router.push('/users');
    } catch (err: any) {
      console.error('Failed to create user:', err);
      setErrors({ global: err.message || 'Failed to create user' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl ${
        theme === 'dark' ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl' : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/users" className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-50 text-slate-400'}`}>
              <FrameworkIcons.Left size={20} />
            </Link>
            <div>
              <h1 className={`text-3xl font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Create User
              </h1>
              <p className="text-slate-500 font-semibold text-sm tracking-tight opacity-70">
                Create a user account and assign roles.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <Button 
                variant="ghost"
                className="px-6 h-11 rounded-xl font-bold text-[11px] tracking-tight uppercase"
                onClick={() => router.back()}
             >
                Cancel
             </Button>
             <Button 
                className="px-8 h-11 rounded-xl font-bold text-[11px] tracking-tight uppercase text-white shadow-xl shadow-indigo-500/20"
                icon={<FrameworkIcons.Check size={16} />}
                isLoading={saving}
                onClick={handleSubmit}
             >
                Create User
             </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
         <form onSubmit={handleSubmit} className="space-y-8">
            <Card title="Account Details">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">E-Mail Address</label>
                     <Input 
                        placeholder="user@fromcode.com" 
                        value={formData.email} 
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                        className="h-11 rounded-xl"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Username</label>
                     <Input 
                        placeholder="username" 
                        value={formData.username} 
                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                        className="h-11 rounded-xl"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">First Name</label>
                     <Input 
                        placeholder="First name" 
                        value={formData.firstName} 
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                        className="h-11 rounded-xl"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Last Name</label>
                     <Input 
                        placeholder="Last name" 
                        value={formData.lastName} 
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                        className="h-11 rounded-xl"
                     />
                  </div>
               </div>
            </Card>

            <Card title="Security Setup">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Initial Password</label>
                     <Input 
                        type="password"
                        placeholder="••••••••" 
                        value={formData.password} 
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        error={errors.password}
                        required
                        className="h-11 rounded-xl"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Confirm Password</label>
                     <Input 
                        type="password"
                        placeholder="••••••••" 
                        value={formData.confirmPassword} 
                        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                        error={errors.confirmPassword}
                        required
                        className="h-11 rounded-xl"
                     />
                  </div>
               </div>
            </Card>

            <Card title="Roles & Permissions">
               <div className="space-y-4 py-2">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-500 font-medium">
                      Permissions are inherited from roles. Assign roles now so the user has the correct access immediately.
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-tight text-indigo-500">
                      {formData.roles.length} selected
                    </span>
                  </div>

                  {loadingRoles ? (
                    <div className="text-sm text-slate-500 font-medium py-6">Loading roles...</div>
                  ) : roles.length === 0 ? (
                    <div className="text-sm text-slate-500 font-medium py-6">
                      No roles available. Create roles first in Users &gt; Roles.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {roles.map((role) => {
                        const selected = formData.roles.includes(role.slug);
                        return (
                          <button
                            key={role.slug}
                            type="button"
                            onClick={() => toggleRole(role.slug)}
                            className={`text-left rounded-2xl border p-4 transition-all ${
                              selected
                                ? theme === 'dark'
                                  ? 'border-indigo-500 bg-indigo-500/10'
                                  : 'border-indigo-500 bg-indigo-50'
                                : theme === 'dark'
                                  ? 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                  {role.name || role.slug}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {role.description || 'No description'}
                                </p>
                              </div>
                              <div className={`mt-0.5 ${selected ? 'text-indigo-500' : 'text-slate-300'}`}>
                                <FrameworkIcons.Check size={16} />
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                              <span>{role.slug}</span>
                              <span>{Array.isArray(role.permissions) ? role.permissions.length : 0} permissions</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {errors.roles && (
                    <div className="text-sm text-rose-500 font-semibold">{errors.roles}</div>
                  )}
               </div>
            </Card>

            <Card title="Access Controls">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Account Status</label>
                     <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant={formData.accountStatus === 'active' ? 'primary' : 'outline'}
                          size="sm"
                          className="rounded-lg"
                          onClick={() => setFormData({ ...formData, accountStatus: 'active' })}
                        >
                          Active
                        </Button>
                        <Button
                          type="button"
                          variant={formData.accountStatus === 'suspended' ? 'primary' : 'outline'}
                          size="sm"
                          className="rounded-lg"
                          onClick={() => setFormData({ ...formData, accountStatus: 'suspended' })}
                        >
                          Suspended
                        </Button>
                     </div>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-tight text-slate-500 ml-1">Force Password Reset</label>
                     <div className="pt-2">
                       <Switch
                         checked={formData.forcePasswordReset}
                         onChange={(checked) => setFormData({ ...formData, forcePasswordReset: checked })}
                       />
                     </div>
                  </div>
               </div>
            </Card>

            {errors.global && (
               <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold flex items-center gap-3 tracking-tight">
                  <FrameworkIcons.Warning size={18} />
                  {errors.global}
               </div>
            )}
         </form>
      </div>
    </div>
  );
}
