"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/components/theme-context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';
import { Loader } from '@/components/ui/loader';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

export default function UserProfilePage() {
  const { theme } = useTheme();
  const { id } = useParams();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await api.get(ENDPOINTS.SYSTEM.USER(id as string));
        setUser(data);
      } catch (err) {
        console.error('Failed to fetch user:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader label="Synchronizing Identity..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen space-y-4">
        <h1 className="text-2xl font-black text-slate-400 uppercase tracking-[0.2em]">User Not Found</h1>
        <Link href="/users">
          <Button variant="ghost">Return to Database</Button>
        </Link>
      </div>
    );
  }

  const initials = user.firstName && user.lastName 
    ? `${user.firstName[0]}${user.lastName[0]}` 
    : user.email[0].toUpperCase();

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-700">
      {/* Profile Header */}
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl ${
        theme === 'dark' ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl' : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-8 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/users" className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500' : 'hover:bg-slate-50 text-slate-400'}`}>
              <FrameworkIcons.Left size={20} />
            </Link>
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-600 flex items-center justify-center text-xl font-black text-white shadow-xl shadow-indigo-500/20 ring-4 ring-indigo-500/10">
              {initials}
            </div>
            <div>
              <h1 className={`text-2xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {user.firstName ? `${user.firstName} ${user.lastName}` : user.email.split('@')[0]}
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{user.email}</span>
                <Badge variant="blue" className="text-[8px] px-2 py-0 border-none">ID: {user.id}</Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <Link href={`/users/${id}/edit`}>
                <Button 
                  variant="secondary"
                  className="px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] border-slate-200 dark:border-slate-800"
                  icon={<FrameworkIcons.Settings size={16} />}
                >
                  Edit Profile
                </Button>
             </Link>
             <Link href={`/users/${id}/roles`}>
                <Button 
                  className="px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] text-white"
                  icon={<FrameworkIcons.Shield size={16} />}
                >
                  Configure RBAC
                </Button>
             </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-6 lg:px-12 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card title="Account Information">
              <div className="grid grid-cols-2 gap-8 py-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">First Name</span>
                  <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{user.firstName || 'Not Set'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last Name</span>
                  <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{user.lastName || 'Not Set'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">E-Mail Address</span>
                  <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{user.email}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Username</span>
                  <p className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{user.username || 'Not Set'}</p>
                </div>
              </div>
            </Card>

            <Card title="Assigned Security Roles" icon={<FrameworkIcons.Shield size={18} className="text-indigo-500" />}>
               <div className="flex flex-wrap gap-3 py-2">
                 {user.roles && user.roles.length > 0 ? (
                    user.roles.map((role: string) => (
                      <div key={role} className={`px-6 py-4 rounded-2xl border flex items-center gap-4 transition-all hover:border-indigo-500/50 hover:shadow-lg ${
                        theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100 shadow-sm'
                      }`}>
                         <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                         <div>
                            <span className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{role}</span>
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">Custom Security Definition</p>
                         </div>
                      </div>
                    ))
                 ) : (
                    <p className="text-slate-500 font-bold text-sm italic py-4">No roles assigned to this account.</p>
                 )}
               </div>
               <div className="mt-8 pt-6 border-t border-slate-800/10 flex justify-end">
                  <Link href={`/users/${id}/roles`}>
                    <Button variant="ghost" className="text-[10px] font-black tracking-widest uppercase text-indigo-500">
                      Manage Assignments
                    </Button>
                  </Link>
               </div>
            </Card>
          </div>

          <div className="space-y-8">
            <Card title="System Metadata">
              <div className="space-y-6">
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Account Type</span>
                    {user.roles && user.roles.includes('admin') ? (
                       <Badge variant="purple" className="px-3">Administrator</Badge>
                    ) : (
                       <Badge variant="amber" className="px-3">Standard</Badge>
                    )}
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Created</span>
                    <span className="text-xs font-bold text-slate-400">{new Date(user.createdAt).toLocaleDateString()}</span>
                 </div>
                 <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last Modified</span>
                    <span className="text-xs font-bold text-slate-400">{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'Never'}</span>
                 </div>
              </div>
            </Card>

            <div className={`p-8 rounded-[2rem] border overflow-hidden relative ${
              theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'
            }`}>
               <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-4">Security Notice</h4>
               <p className="text-xs font-bold leading-relaxed text-slate-500">
                 Modifying user roles or permissions takes effect immediately. Ensure you follow the principle of least privilege when assigning administrative roles.
               </p>
               <FrameworkIcons.Shield className="absolute -bottom-4 -right-4 text-indigo-500/10" size={100} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
