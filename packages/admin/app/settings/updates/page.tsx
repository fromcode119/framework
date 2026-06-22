"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader } from '@/components/ui/loader';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NotificationHooks } from '@/components/use-notification';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@fromcode119/react';
import { ThemeHooks } from '@/components/use-theme';
import { AppEnv } from '@/lib/env';
import { CompactPageHeader } from '@/components/ui/compact-page-header';

export default function UpdatesPage() {
  const { theme } = ThemeHooks.useTheme();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { notify } = NotificationHooks.useNotify();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.UPDATE_CHECK);
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
      const data = await AdminApi.post(AdminConstants.ENDPOINTS.SYSTEM.UPDATE_APPLY);
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

  const installedVersion = String(status?.current || AppEnv.APP_VERSION || '').trim();
  const latestVersion = String(status?.latest || installedVersion || '').trim();
  const hasUpdate = Boolean(status?.hasUpdate && latestVersion && latestVersion !== installedVersion);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">
      <CompactPageHeader
        theme={theme}
        icon={<FrameworkIcons.System size={18} strokeWidth={2} />}
        title="System Updates"
        subtitle="Framework core & registry synchronization"
        actions={
          <button
            onClick={fetchStatus}
            disabled={loading}
            className={`flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold tracking-tight transition-all active:scale-95 ${
              theme === 'dark'
                ? 'bg-slate-800 text-slate-100 hover:bg-slate-700'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <FrameworkIcons.Loader className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Verifying Registry...' : 'Check For Updates'}
          </button>
        }
      />

      <div className="p-6 w-full space-y-6 pb-10">
        <Card className={`p-6 border-0 rounded-2xl overflow-hidden relative ${theme === 'dark' ? 'bg-slate-900/40 ring-1 ring-white/5' : 'bg-white shadow-sm'}`}>
          {/* Background Accent */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[80px] -translate-y-1/2 translate-x-1/2 rounded-full" />

          <div className="flex flex-col xl:flex-row items-start gap-6 relative">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600'}`}>
              <FrameworkIcons.System size={32} strokeWidth={1.5} />
            </div>

            <div className="flex-1 space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Fromcode Core Engine</h2>
                  <Badge variant={hasUpdate ? 'warning' : 'success'} className="px-3 py-1 text-[10px] font-bold tracking-tight rounded-full">
                    {hasUpdate ? 'Update Available' : 'Framework Up to Date'}
                  </Badge>
                </div>

                <p className={`text-sm leading-relaxed max-w-2xl ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  The core engine powers all API, Database, and Plugin infrastructure. Keeping it updated ensures
                  the highest security, stability, and performance for your enterprise platform.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100/80'}`}>
                  <div className="text-[10px] font-bold tracking-tight text-slate-400 mb-2">Installed Version</div>
                  <div className={`font-mono font-bold text-2xl ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>v{installedVersion}</div>
                </div>
                <div className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-slate-800/40 border-white/5' : 'bg-slate-50 border-slate-100/80'}`}>
                  <div className="text-[10px] font-bold tracking-tight text-slate-400 mb-2">Latest Registry Version</div>
                  <div className={`font-mono font-bold text-2xl ${theme === 'dark' ? 'text-white' : 'text-slate-700'}`}>v{latestVersion}</div>
                </div>
              </div>

              {hasUpdate && (
                <div className={`mt-5 p-5 rounded-xl border ${theme === 'dark' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center gap-2.5 text-amber-600 font-semibold tracking-tight mb-2">
                    <div className="p-1.5 bg-amber-500/10 rounded-lg">
                      <FrameworkIcons.Warning size={18} />
                    </div>
                    <span>v{latestVersion} Recommended Update</span>
                  </div>
                  <p className={`text-sm leading-relaxed mb-5 ${theme === 'dark' ? 'text-amber-200/70' : 'text-amber-800/80'}`}>
                    This version introduces cumulative improvements to the plugin isolation layer
                    and enhanced database driver stability. Apply this update to ensure compatibility with latest plugins.
                  </p>
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={updating}
                    className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold tracking-tight text-xs transition-colors shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {updating ? 'Applying Update...' : 'Install Core v' + latestVersion}
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
          description={`You are about to update Fromcode Core from v${installedVersion} to v${latestVersion}. A complete system backup will be created automatically before proceeding. This process will overwrite system files and may cause a temporary service disruption while the server restarts.`}
        />
      </div>
    </div>
  );
}
