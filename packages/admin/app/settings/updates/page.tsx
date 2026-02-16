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
       <Loader label="Checking Framework Registry..." size="lg" />
    </div>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-4xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>System Updates</h1>
          <p className="text-slate-500 mt-2 font-medium text-lg">Manage framework core and system-level updates.</p>
        </div>
        <button 
          onClick={fetchStatus}
          disabled={loading}
          className={`flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-semibold uppercase tracking-wide transition-all ${
            theme === 'dark' ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FrameworkIcons.Refresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Checking...' : 'Check For Updates'}
        </button>
      </div>

      <Card className={`p-10 border-0 overflow-hidden relative ${theme === 'dark' ? 'bg-slate-900/40 ring-1 ring-white/5' : 'bg-white shadow-2xl shadow-slate-200/50'}`}>
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-3xl -translate-y-1/2 translate-x-1/2 rounded-full" />
        
        <div className="flex flex-col md:flex-row items-start gap-10 relative">
          <div className={`h-24 w-24 rounded-3xl flex items-center justify-center shrink-0 transition-transform duration-700 hover:scale-110 hover:rotate-3 shadow-xl ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 shadow-indigo-100'}`}>
            <FrameworkIcons.System size={48} strokeWidth={1.5} />
          </div>
          <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <h2 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Fromcode Core Engine</h2>
              <Badge variant={status?.hasUpdate ? 'warning' : 'success'} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide">
                {status?.hasUpdate ? 'Update Available' : 'Framework Up to Date'}
              </Badge>
            </div>
            
            <p className={`text-base font-medium leading-relaxed max-w-2xl ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              The core engine powers all API, Database, and Plugin infrastructure. Keeping it updated ensures
              the highest security, stability, and performance for your platform.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className={`p-5 rounded-3xl border transition-all ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Installed Version</div>
                <div className={`font-mono font-bold text-2xl ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>v{status?.current}</div>
              </div>
              <div className={`p-5 rounded-3xl border transition-all ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Latest Version</div>
                <div className={`font-mono font-bold text-2xl ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>v{status?.latest || status?.current}</div>
              </div>
            </div>

            {status?.hasUpdate && (
              <div className={`mt-8 p-8 rounded-[2rem] border transition-all transform hover:scale-[1.01] ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-3 text-amber-600 font-semibold uppercase tracking-tight mb-3">
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
                  className="w-full sm:w-auto px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-semibold uppercase tracking-wide text-[12px] transition-all shadow-2xl shadow-indigo-600/30 active:scale-95 disabled:opacity-50"
                >
                  {updating ? 'Applying Update...' : 'Install Core v' + status.latest}
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {status?.lastUpdated && (
        <div className="text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500 opacity-40">
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
  );
}
