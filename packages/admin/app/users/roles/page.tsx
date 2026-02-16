'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/components/theme-context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FrameworkIcons } from '@/lib/icons';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useNotify } from '@/components/notification-context';
import { Loader } from '@/components/ui/loader';

export default function RolesPage() {
  const { theme } = useTheme();
  const { notify } = useNotify();
  const [roles, setRoles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchData() {
    try {
      setLoading(true);
      const [rolesRes, logsRes] = await Promise.all([
        api.get(ENDPOINTS.SYSTEM.ROLES),
        api.get(ENDPOINTS.SYSTEM.LOGS)
      ]);
      setRoles(rolesRes || []);
      setLogs(logsRes || []);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <Loader label="Hydrating Security Matrix..." />
      </div>
    );
  }

  const handleDelete = async () => {
    if (!roleToDelete) return;
    setIsDeleting(true);
    try {
      await api.delete(`${ENDPOINTS.SYSTEM.ROLES}/${roleToDelete.slug}`);
      notify('success', 'Role Deleted', `${roleToDelete.name} has been removed.`);
      fetchData();
      setShowDeleteConfirm(false);
    } catch (err: any) {
      notify('error', 'Deletion Failed', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      {/* Premium Roles Header */}
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)]'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className={`h-11 w-11 rounded-full flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 ${
                  theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-600 text-white'
                }`}>
                  <FrameworkIcons.Shield size={22} strokeWidth={2} />
                </div>
                <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Roles
                </h1>
              </div>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                Manage user roles and security permissions.
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Link href="/users/roles/new">
                <Button 
                  className="px-6 h-11 rounded-xl font-bold uppercase tracking-tight text-[11px] shadow-lg shadow-indigo-600/10 text-white" 
                  icon={<FrameworkIcons.Plus size={16} strokeWidth={2} />}
                >
                  Create Role
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-6 lg:px-12 py-12">
        <div className="space-y-8 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-12 xl:col-span-8 space-y-6">
              <Card title="System Roles & Security Groups">
                <div className="grid grid-cols-1 gap-6">
                  {roles.map((role) => (
                    <div key={role.slug} className={`group p-6 md:p-8 rounded-[2.5rem] border transition-all duration-500 ${
                      theme === 'dark' 
                        ? 'bg-slate-950/40 border-slate-800/50 hover:border-indigo-500/30' 
                        : 'bg-white border-slate-200/60 hover:border-indigo-500/40 hover:shadow-[0_20px_50px_-12px_rgba(79,70,229,0.1)]'
                    }`}>
                      <div className="flex flex-col lg:flex-row items-start justify-between gap-8">
                        <div className="flex flex-col sm:flex-row gap-8 w-full">
                          <div className={`h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-2xl ${
                            role.type === 'system' 
                              ? (theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-600 text-white shadow-indigo-600/30')
                              : (theme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')
                          }`}>
                            <FrameworkIcons.Shield size={32} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-3 mb-3">
                              <h3 className={`font-bold text-2xl tracking-tight transition-colors group-hover:text-indigo-600 ${theme === 'dark' ? 'text-white group-hover:text-indigo-400' : 'text-slate-900'}`}>{role.name}</h3>
                              <code className={`text-[10px] font-bold uppercase tracking-tight px-3 py-1 rounded-full ${
                                theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 border border-slate-200 text-slate-500'
                              }`}>
                                {role.slug}
                              </code>
                            </div>
                            <p className="text-base font-bold text-slate-500 leading-relaxed max-w-2xl mb-8">{role.description}</p>
                            
                            <div className="flex flex-wrap items-center gap-x-12 gap-y-6">
                               <div className="flex flex-col gap-1">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Active Members</span>
                                 <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{role.users || 0} Users</span>
                               </div>
                               <div className="flex flex-col gap-1">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Scope</span>
                                 <div className="flex gap-2">
                                   <span className="text-[11px] font-bold text-indigo-500/80">
                                     {role.permissions?.length || 0} Permissions
                                   </span>
                                 </div>
                               </div>
                               <div className="flex flex-col gap-1">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Last Modified</span>
                                 <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                   {role.updatedAt ? new Date(role.updatedAt).toLocaleDateString() : 'Initial'}
                                 </span>
                               </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-row lg:flex-col items-center lg:items-end gap-4 w-full lg:w-auto">
                          {role.type === 'system' ? (
                            <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                               <FrameworkIcons.Lock size={14} strokeWidth={2} />
                               <span className="font-bold uppercase tracking-tight text-[10px]">Immutable</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <Link href={`/users/roles/${role.slug}/edit`}>
                                <Button variant="ghost" className="h-12 w-12 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 shadow-sm">
                                  <FrameworkIcons.Edit size={22} />
                                </Button>
                              </Link>
                              <Button 
                                variant="ghost" 
                                onClick={() => { setRoleToDelete(role); setShowDeleteConfirm(true); }}
                                className="h-12 w-12 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 shadow-sm"
                              >
                                <FrameworkIcons.Trash size={22} />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="lg:col-span-12 xl:col-span-4 space-y-8">
              <Card title="Security Architecture">
                <div className="space-y-6">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight leading-none">Access Control</span>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed">
                      Roles define the maximum privilege boundary for all associated identities.
                    </p>
                  </div>
                  
                  <div className={`p-5 rounded-2.5xl border ${theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/10' : 'bg-indigo-50 border-indigo-100'}`}>
                    <h4 className="text-[10px] font-bold uppercase tracking-tight text-indigo-500 mb-2">Live Enforcement</h4>
                    <p className="text-[11px] font-bold text-indigo-600/70 dark:text-indigo-400/70 leading-relaxed">
                      RBAC policies are synchronized across the cluster in real-time.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className={`overflow-hidden transition-all duration-500 group/feed ${
                theme === 'dark' 
                  ? 'border-indigo-500/20 bg-indigo-500/[0.03]' 
                  : 'hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] transition-shadow'
              }`}>
                <div className="flex flex-col gap-6 mb-10">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-500 group-hover/feed:scale-110 group-hover/feed:rotate-3 ${
                        theme === 'dark' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-600 text-white'
                      }`}>
                        <FrameworkIcons.Search size={20} strokeWidth={2} />
                      </div>
                      <div>
                        <h3 className={`text-[10px] font-bold uppercase tracking-tight ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                          System Audit Logs
                        </h3>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-1 opacity-70">Real-time Security Streams</p>
                      </div>
                    </div>
                    
                    <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 border shadow-sm ${
                      theme === 'dark' ? 'bg-slate-950 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                    }`}>
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-bold uppercase tracking-tight">Encrypted</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 relative before:absolute before:left-[23.5px] before:top-3 before:bottom-3 before:w-[1px] before:bg-slate-100 dark:before:bg-slate-800/60">
                  {loading ? (
                     [1,2,3].map(i => (
                      <div key={i} className="flex gap-6 relative animate-pulse">
                        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800" />
                        <div className="flex-1 space-y-2 py-1">
                          <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-3/4" />
                          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-1/2" />
                        </div>
                      </div>
                     ))
                  ) : logs.length > 0 ? (
                    logs.slice(0, 5).map((log, i) => (
                      <div key={log.id || i} className="flex gap-6 relative group/item cursor-default">
                        <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all duration-300 group-hover/item:scale-110 shadow-lg ${
                          theme === 'dark' ? 'bg-slate-950 border border-slate-800' : 'bg-white border border-slate-200'
                        }`}>
                          <div className={`h-2.5 w-2.5 rounded-full ${
                            log.level === 'ERROR' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' :
                            log.level === 'WARN' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 
                            'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                          }`} />
                        </div>
                        <div className="flex flex-col justify-center">
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold tracking-tight ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                              {log.message}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 gap-1 flex uppercase tracking-tight leading-none">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight flex items-center gap-1.5 mt-0.5 opacity-70">
                             {(() => {
                               const slug = log.plugin_slug || 'System';
                               return slug.charAt(0).toUpperCase() + slug.slice(1);
                             })()}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 opacity-40 text-[10px] uppercase font-bold tracking-tight">No activity logged</div>
                  )}
                </div>
                
                <div className={`mt-10 pt-8 border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold uppercase tracking-tight text-slate-400">Environment Node 102.v2</span>
                      <span className="text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase mt-0.5 tracking-tight">Secure Cluster: Active</span>
                    </div>
                    <Link href="/activity">
                      <Button variant="ghost" className="h-9 px-4 rounded-lg text-[9px] font-bold uppercase tracking-tight hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        View Logs
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Footer */}
      <div className={`mt-auto border-t ${
        theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400">
                  Roles Management
                </span>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Manage and customize system access roles.</p>
            </div>
            
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tight text-slate-400">
               <Link href="/users" className="hover:text-indigo-500 transition-colors">Users</Link>
               <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />
               <Link href="/users/permissions" className="hover:text-indigo-500 transition-colors">Permissions</Link>
               <span className="h-1 w-1 rounded-full bg-slate-200 dark:bg-slate-800" />
               <Link href="/activity" className="hover:text-indigo-500 transition-colors">Activity Log</Link>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Role"
        description={`Are you sure you want to remove the ${roleToDelete?.name} role? Users assigned to this role may lose access to critical system features.`}
        confirmLabel="Destroy Role"
      />
    </div>
  );
}
