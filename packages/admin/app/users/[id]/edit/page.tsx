"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';
import { Loader } from '@/components/ui/Loader';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function EditUserPage() {
  const { theme } = useTheme();
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await api.get(ENDPOINTS.SYSTEM.USER(id as string));
        setFormData({
          email: data.email || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          password: '',
          confirmPassword: ''
        });
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    if (formData.password && formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' });
      setSaving(false);
      return;
    }

    try {
      await api.put(ENDPOINTS.SYSTEM.USER(id as string), formData);
      router.push(`/users/${id}`);
    } catch (err: any) {
      console.error('Failed to update user:', err);
      setErrors({ global: err.message || 'Failed to update user' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader label="Synchronizing Identity Details..." />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl ${
        theme === 'dark' ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl' : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={`/users/${id}`} className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-50 text-slate-400'}`}>
              <FrameworkIcons.Left size={20} />
            </Link>
            <div>
              <h1 className={`text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Edit Account
              </h1>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                Update profile information and security credentials.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <Button 
                variant="ghost"
                className="px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px]"
                onClick={() => router.back()}
             >
                Cancel
             </Button>
             <Button 
                className="px-8 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] text-white shadow-xl shadow-indigo-500/20"
                icon={<FrameworkIcons.Check size={16} />}
                isLoading={saving}
                onClick={handleSubmit}
             >
                Save Changes
             </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-12">
         <form onSubmit={handleSubmit} className="space-y-8">
            <Card title="Profile Details">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">E-Mail Address</label>
                     <Input 
                        placeholder="user@example.com" 
                        value={formData.email} 
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        required
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">First Name</label>
                     <Input 
                        placeholder="John" 
                        value={formData.firstName} 
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Last Name</label>
                     <Input 
                        placeholder="Doe" 
                        value={formData.lastName} 
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                     />
                  </div>
               </div>
            </Card>

            <Card title="Security Credentials" icon={<FrameworkIcons.Shield size={18} className="text-amber-500" />}>
               <p className="text-xs font-bold text-slate-500 mb-6 bg-amber-500/5 p-4 rounded-xl border border-amber-500/10">
                 Leave password fields blank if you do not wish to change the current password.
               </p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">New Password</label>
                     <Input 
                        type="password"
                        placeholder="••••••••" 
                        value={formData.password} 
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Confirm Password</label>
                     <Input 
                        type="password"
                        placeholder="••••••••" 
                        value={formData.confirmPassword} 
                        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                        error={errors.confirmPassword}
                     />
                  </div>
               </div>
            </Card>

            {errors.global && (
               <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm font-bold flex items-center gap-3">
                  <FrameworkIcons.Warning size={18} />
                  {errors.global}
               </div>
            )}
         </form>
      </div>
    </div>
  );
}
