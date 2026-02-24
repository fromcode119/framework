"use client";

import React, { useState } from 'react';
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
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    firstName: '',
    lastName: '',
    accountStatus: 'active',
    forcePasswordReset: false,
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

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
                New Identity
              </h1>
              <p className="text-slate-500 font-semibold text-sm tracking-tight opacity-70">
                Register a new user in the system domain.
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
                Provision Account
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

            <Card title="Security Setup" icon={<FrameworkIcons.Shield size={18} className="text-emerald-500" />}>
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

            <Card title="Access Controls" icon={<FrameworkIcons.Key size={18} className="text-indigo-500" />}>
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
