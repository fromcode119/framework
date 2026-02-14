"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTheme } from '@/components/theme-context';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Loader } from '@/components/ui/loader';

export default function UserRolesPage() {
  const { id } = useParams();
  const router = useRouter();
  const { theme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, rolesRes] = await Promise.all([
          api.get(ENDPOINTS.SYSTEM.USERS),
          api.get(ENDPOINTS.SYSTEM.ROLES)
        ]);
        
        const foundUser = (usersRes.docs || []).find((u: any) => String(u.id) === String(id));
        if (foundUser) {
          setUser(foundUser);
          setSelectedRoles(foundUser.roles || []);
        }
        
        setRoles(rolesRes || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post(ENDPOINTS.SYSTEM.USER_ROLES, {
        userId: id,
        roles: selectedRoles
      });
      router.push('/users');
    } catch (err) {
      console.error('Failed to save roles:', err);
      alert('Failed to save roles');
    } finally {
      setSaving(false);
    }
  };

  const toggleRole = (slug: string) => {
    setSelectedRoles(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  if (loading) return <Loader label="Analyzing User Privileges" className="py-20" />;
  if (!user) return <div className="p-8 text-center font-bold text-red-500">User not found</div>;

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
               <Link href="/users">
                 <button className={`h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg ${
                   theme === 'dark' ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 shadow-slate-200/50 hover:shadow-indigo-500/10'
                 }`}>
                   <FrameworkIcons.Left size={20} strokeWidth={2.5} />
                 </button>
               </Link>
               <div>
                 <h1 className={`text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                   Manage User Roles
                 </h1>
                 <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 opacity-70">Enforcing access for {user.email}</p>
               </div>
            </div>
            
            <Button 
              className="px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-600/10 text-white" 
              isLoading={saving}
              onClick={handleSave}
              icon={<FrameworkIcons.Save size={16} strokeWidth={2.5} />}
            >
              Save
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-6 lg:px-12 py-12">
        <div className="space-y-6 pb-20">
          <div className="grid grid-cols-1 gap-4">
            {roles.map(role => {
              const isSelected = selectedRoles.includes(role.slug);
              return (
                <div 
                  key={role.slug}
                  onClick={() => toggleRole(role.slug)}
                  className={`relative group cursor-pointer p-6 rounded-3xl border-2 transition-all duration-300 ${
                    isSelected 
                      ? (theme === 'dark' ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/10' : 'bg-indigo-50 border-indigo-500 shadow-lg shadow-indigo-500/5')
                      : (theme === 'dark' ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-100 hover:border-slate-200 shadow-sm')
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${
                          isSelected 
                            ? (theme === 'dark' ? 'bg-indigo-500 text-white' : 'bg-indigo-600 text-white')
                            : (theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')
                        }`}>
                          <FrameworkIcons.Shield size={16} />
                        </div>
                        <span className={`text-lg font-black tracking-tight ${
                          isSelected 
                           ? (theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600')
                           : (theme === 'dark' ? 'text-slate-200' : 'text-slate-900')
                        }`}>
                          {role.name}
                        </span>
                      </div>
                      <p className={`text-sm font-medium pl-11 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {role.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                        : (theme === 'dark' ? 'border-slate-700' : 'border-slate-200')
                    }`}>
                      {isSelected && <FrameworkIcons.Check size={14} strokeWidth={4} />}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-4 pl-11 flex flex-wrap gap-2">
                      {(role.permissions || []).slice(0, 5).map((p: string) => (
                        <Badge key={p} variant="blue" className="text-[9px] uppercase tracking-widest px-2 py-0.5 opacity-70">
                          {p}
                        </Badge>
                      ))}
                      {(role.permissions || []).length > 5 && (
                        <span className="text-[9px] font-bold text-slate-400">
                          +{(role.permissions || []).length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
