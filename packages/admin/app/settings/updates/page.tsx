"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader } from '@/components/ui/loader';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useNotify } from '@/components/notification-context';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';
import { useTheme } from '@/components/theme-context';

export default function UpdatesPage() {
  const { theme } = useTheme();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { notify } = useNotify();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await api.get(ENDPOINTS.SYSTEM.UPDATE_CHECK);
      setStatus(data);
    } catch (err: any) {
      notify('error', 'Update Check Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      notify('info', 'Update Started', 'Creating system backup and applying updates. This may take a minute.');
      const data = await api.post(ENDPOINTS.SYSTEM.UPDATE_APPLY);
      notify('success', 'Update Complete', `System updated to v${data.version}. The page will now refresh.`);
      setShowConfirm(false);
      
      // Wait a bit for the notify to be seen and for potential server restart
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (err: any) {
      notify('error', 'Update Failed', err.message);
      setUpdating(false);
    }
  };

  if (loading && !status) return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
       <Loader label="Checking Framework Registry..." />
    </div>
  );

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      {/* Sub-Page Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-md px-8 py-6 flex items-center justify-between ${
        theme === 'dark' ? 'bg-slate-950/50 border-slate-800' : 'bg-white/50 border-slate-100'
      }`}>
        <div>
          <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            System Updates
          </h1>
          <p className="text-[10px] font-bold text-slate-500 tracking-tight uppercase opacity-60">
            Framework core & registry synchronization
          </p>
        </div>
        <button 
          onClick={fetchStatus}
          disabled={loading}
          className={`flex items-center gap-3 px-6 py-3 rounded-xl text-[11px] font-bold tracking-tight transition-all shadow-lg active:scale-95 ${
            theme === 'dark' 
              ? 'bg-slate-800 text-slate-100 hover:bg-slate-700 shadow-slate-900/20' 
              : 'bg-white text-slate-600 hover:bg-slate-50 shadow-slate-200/50 border border-slate-100'
          }`}
        >
          <FrameworkIcons.Refresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Verifying Registry...' : 'Check For Updates'}
        </button>
      </div>

      <div className="p-8 lg:p-12 max-w-5xl space-y-10 pb-20">
        <Card className={`p-10 border-0 rounded-[2.5rem] overflow-hidden relative transition-all duration-500 ${theme === 'dark' ? 'bg-slate-900/40 ring-1 ring-white/5' : 'bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)]'}`}>
          {/* Background Accent */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[80px] -translate-y-1/2 translate-x-1/2 rounded-full" />
          
          <div className="flex flex-col xl:flex-row items-start gap-10 relative">
            <div className={`h-24 w-24 rounded-[1.5rem] flex items-center justify-center shrink-0 transition-all duration-700 hover:scale-110 hover:rotate-3 shadow-2xl ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 shadow-indigo-100'}`}>
              <FrameworkIcons.System size={48} strokeWidth={1.5} />
            </div>
            
            <div className="flex-1 space-y-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4">
                  <h2 className={`text-3xl font-bold tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Fromcode Core Engine</h2>
                  <Badge variant={status?.hasUpdate ? 'warning' : 'success'} className="px-4 py-1.5 text-[10px] font-bold tracking-tight rounded-full">
                    {status?.hasUpdate ? 'Update Available' : 'Framework Up to Date'}
                  </Badge>
                </div>
                
                <p className={`text-base font-bold tracking-tight leading-relaxed max-w-2xl ${theme === 'dark' ? 'text-slate-400/80' : 'text-slate-500'}`}>
                  The core engine powers all API, Database, and Plugin infrastructure. Keeping it updated ensures
                  the highest security, stability, and performance for your enterprise platform.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className={`p-6 rounded-[1.5rem] border transition-all ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100/80'}`}>
                  <div className="text-[10px] font-bold tracking-tight text-slate-400 mb-2">Installed Version</div>
                  <div className={`font-mono font-bold text-2xl ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>v{status?.current}</div>
                </div>
                <div className={`p-6 rounded-[1.5rem] border transition-all ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100/80'}`}>
                  <div className="text-[10px] font-bold tracking-tight text-slate-400 mb-2">Latest Registry Version</div>
                  <div className={`font-mono font-bold text-2xl ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>v{status?.latest || status?.current}</div>
                </div>
              </div>

              {status?.hasUpdate && (
                <div className={`mt-8 p-8 rounded-[2rem] border transition-all transform hover:scale-[1.01] ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center gap-3 text-amber-600 font-bold tracking-tight mb-3">
                    <div className="p-2 bg-amber-500/10 rounded-xl">
                      <FrameworkIcons.Warning size={20} />
                    </div>
                    <span>v{status.latest} Recommended Update</span>
                  </div>
                  <p className={`text-sm font-bold leading-relaxed mb-8 ${theme === 'dark' ? 'text-amber-200/60' : 'text-amber-800/70'}`}>
                    This version introduces cumulative improvements to the plugin isolation layer 
                    and enhanced database driver stability. Apply this update to ensure compatibility with latest plugins.
                  </p>
                  <button 
                    onClick={() => setShowConfirm(true)}
                    disabled={updating}
                    className="w-full sm:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold tracking-tight text-[12px] transition-all shadow-2xl shadow-indigo-600/30 active:scale-95 disabled:opacity-50"
                  >
                    {updating ? 'Applying Update...' : 'Install Core v' + status.latest}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {status?.lastUpdated && (
          <div className="text-center text-[10px] font-bold tracking-tight text-slate-500 opacity-40">
            Last Registry Sync: {new Date(status.lastUpdated).toLocaleString()}
          </div>
        )}

        <ConfirmDialog
          isOpen={showConfirm}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleUpdate}
          isLoading={updating}
          title="Apply System Update?"
          description={`You are about to update Fromcode Core from v${status?.current} to v${status?.latest}. A complete system backup will be created automatically before proceeding. This process will overwrite system files and may cause a temporary service disruption while the server restarts.`}
        />
      </div>
    </div>
  );
}
