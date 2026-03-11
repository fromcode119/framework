"use client";

import React, { useEffect, useState } from 'react';
import { Slot, ContextHooks } from '@fromcode119/react';
import { useRouter } from 'next/navigation';
import { AuthHooks } from '@/components/use-auth';
import { StatCard } from '@/components/ui/stat-card';
import { Card } from '@/components/ui/card';
import { CardHeader } from '@/components/ui/card-header';
import { Button } from '@/components/ui/button';
import { PageHeading } from '@/components/ui/page-heading';
import { Icon as DynamicIcon } from '@/components/icon';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { FrameworkIcons } from '@/lib/icons';
import { AppEnv } from '@/lib/env';

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = AuthHooks.useAuth();
  const { slots, refreshVersion } = ContextHooks.usePlugins();
  const [stats, setStats] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [activePluginsCount, setActivePluginsCount] = useState<number>(0);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);
  const [showAllCollections, setShowAllCollections] = useState(false);
  
  const hasMainContent = slots['admin.dashboard.main'] && slots['admin.dashboard.main'].length > 0;
  
  const userStats = stats.find(s => s.slug === 'users');
  const userCount = userStats ? String(userStats.count) : '0';

  useEffect(() => {
    if (isAuthLoading || !user) return;

    async function fetchStats() {
      try {
        const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.STATS.COLLECTIONS);
        if (Array.isArray(data)) {
          // Dynamic sorting based on API-provided priority
          const sorted = [...data].sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return (a.name || a.slug).localeCompare(b.name || b.slug);
          });
          setStats(sorted);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoadingStats(false);
      }
    }

    async function fetchPlugins() {
      try {
        const data = await AdminApi.get(AdminConstants.ENDPOINTS.PLUGINS.ACTIVE);
        if (Array.isArray(data)) {
          setActivePluginsCount(data.length);
        }
      } catch (err) {
        console.error("Failed to fetch plugins count:", err);
      }
    }

    async function fetchActivity() {
      try {
        // Pull from system logs instead of collection audit for "Plugin Activity"
        const response = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.LOGS);
        const data = response.docs || response;
        if (Array.isArray(data)) {
          // Map system logs to the UI format
          setActivity(data.map(log => ({
            id: log.id,
            title: log.message,
            timestamp: log.timestamp,
            plugin: log.pluginSlug,
            level: log.level
          })));
        }
      } catch (err) {
        console.error("Failed to fetch dashboard activity:", err);
      } finally {
        setLoadingActivity(false);
      }
    }

    async function fetchUpdate() {
      try {
        const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.UPDATE_CHECK);
        if (data && data.hasUpdate) {
          setUpdateAvailable(data);
        }
      } catch (err) {
        // Silent fail on dashboard
      }
    }

    fetchStats();
    fetchPlugins();
    fetchActivity();
    fetchUpdate();
  }, [isAuthLoading, user, refreshVersion]);

  return (
    <div className="w-full pb-24 animate-in fade-in duration-500">
      {/* Premium Dashboard Header */}
      <div className="sticky top-0 z-30 border-b backdrop-blur-3xl transition-all duration-300 bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)] dark:bg-slate-950/80 dark:border-slate-800/50 dark:shadow-2xl dark:shadow-black/20">
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <PageHeading
              icon={
                <div className="h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 bg-indigo-600 text-white dark:bg-indigo-500/10 dark:text-indigo-400">
                  <FrameworkIcons.Layout size={20} strokeWidth={2.5} />
                </div>
              }
              title={`Hello, ${user?.email?.split('@')[0] || 'Administrator'}`}
              subtitle={
                <>
                  System status is <span className="text-emerald-500">Optimized</span> • {user?.email}
                </>
              }
              titleClassName="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none italic"
              subtitleClassName="text-slate-500 font-bold text-sm tracking-tight opacity-70 mt-2"
            />
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end pr-4 border-r border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold tracking-tight text-slate-400 uppercase">Current Session</span>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">Authenticated via UI</span>
              </div>
              <div className="px-5 h-11 rounded-2xl border flex items-center gap-3 text-[11px] font-bold tracking-tight shadow-sm transition-all hover:scale-[1.02] bg-white border-slate-100 text-slate-500 hover:text-indigo-600 hover:shadow-indigo-500/5 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300">
                <FrameworkIcons.Clock size={16} className="text-indigo-500" />
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-12 pt-12 space-y-8 pb-12">
        {/* Update Alert */}
        {updateAvailable && (
          <div className="p-1 rounded-[2rem] animate-in slide-in-from-top-4 duration-500 bg-gradient-to-r from-amber-500/10 via-amber-100/50 to-white dark:from-amber-500/20 dark:via-amber-600/10 dark:to-transparent border border-amber-500/20 shadow-xl shadow-amber-500/5">
            <div className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 rounded-[1.9rem] bg-white/80 dark:bg-slate-900/40">
              <div className="flex items-center gap-5">
                <div className="h-12 w-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <FrameworkIcons.Loader size={24} className="animate-spin" />
                </div>
                <div>
                  <h4 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                    Framework Update Available
                  </h4>
                  <p className="text-sm font-bold text-slate-500 tracking-tight">
                    A new version of Fromcode Core <span className="font-bold text-amber-600">v{updateAvailable.latest}</span> is available.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[11px] font-bold tracking-tight px-6 uppercase"
                  onClick={() => setUpdateAvailable(null)}
                >
                  Dismiss
                </Button>
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold tracking-tight px-8 h-11 rounded-xl shadow-lg shadow-amber-600/30 uppercase"
                  onClick={() => router.push(AdminConstants.ROUTES.SETTINGS.UPDATES)}
                >
                  View Update Details
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            title="Users" 
            value={loadingStats ? "..." : userCount} 
            icon={<FrameworkIcons.Users size={20} />} 
            trend={{ value: 12, isPositive: true }} 
          />
          <StatCard 
            title="Plugin Extensions" 
            value={String(activePluginsCount)} 
            icon={<FrameworkIcons.Plugins size={20} />} 
            trend={{ value: 5, isPositive: true }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <Slot name="admin.dashboard.stats" />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Slot name="admin.dashboard.top" />
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="h-8 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-500/40"></div>
                <h3 className="text-[11px] font-bold tracking-tight text-slate-900/40 dark:text-slate-400 uppercase">Content Collections</h3>
                <div className="h-px flex-1 bg-slate-200/60 dark:bg-slate-800"></div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowAllCollections(!showAllCollections)}
                className="text-[10px] whitespace-nowrap font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase"
              >
                {showAllCollections ? 'Show Less' : 'View All'}
              </Button>
            </div>

            {/* Main Resources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stats.filter(s => {
                if (s.hidden) return false;
                
                // For core (system===true): users and media are always core
                const isCore = s.system || s.slug === 'users' || s.slug === 'media';
                if (isCore) return true;
                
                // If show all is toggled, show everything not hidden
                if (showAllCollections) return true;

                // Default view filter logic:
                // 1. Hide internal-looking slugs (starting with _ or fcp_)
                // 2. Hide low count entities that aren't core
                if (s.slug.startsWith('_') || s.slug.startsWith('fcp_')) return false;
                
                // Hide empty non-core entities by default
                if (s.count === 0) return false;

                return true;
              }).map(s => {
                const colShortSlug = s.shortSlug || s.slug;
                const colPluginSlug = s.pluginSlug || 'system';
                
                // Content Routing: Platform core entities use root-level paths
                // whilst plugins use /plugin/slug paths.
                let adminPath = `/${colPluginSlug}/${colShortSlug}`;
                const displayPluginSlug = colPluginSlug.charAt(0).toUpperCase() + colPluginSlug.slice(1);
                
                if (colPluginSlug.toLowerCase() === 'system') {
                    if (colShortSlug === 'users') adminPath = '/users';
                    if (colShortSlug === 'media') adminPath = '/media';
                    if (colShortSlug === 'activity') adminPath = '/activity';
                }
                
                return (
                  <div key={s.slug} className="p-6 rounded-3xl border flex items-center justify-between transition-all hover:shadow-xl hover:shadow-indigo-500/5 group cursor-pointer bg-white border-slate-100 shadow-lg shadow-slate-200/50 dark:bg-slate-900/40 dark:border-slate-800 dark:shadow-none animate-in fade-in duration-300" onClick={() => router.push(adminPath)}>
                    <div className="flex items-center gap-4">
                      <div className="p-3.5 rounded-2xl transition-all duration-300 bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-600/20 dark:bg-indigo-500/10 dark:text-indigo-400 dark:group-hover:bg-indigo-500/20">
                        <DynamicIcon name={s.icon || 'Database'} size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                           <p className="text-xs font-bold tracking-tight text-slate-400 uppercase">{s.name || colShortSlug}</p>
                           <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-tight uppercase ${
                               (s.system || colPluginSlug.toLowerCase() === 'system')
                               ? 'bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400' 
                               : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                           }`}>
                             {(s.system || colPluginSlug.toLowerCase() === 'system') ? 'Core' : displayPluginSlug}
                           </span>
                        </div>
                        <h4 className="text-2xl font-bold tracking-tight mt-0.5 text-slate-900 dark:text-white">{s.count}</h4>
                      </div>
                    </div>
                    <div className="p-2 rounded-full h-10 w-10 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                      <FrameworkIcons.ArrowRight size={18} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4">
              <div className="h-8 w-1.5 rounded-full bg-indigo-600 dark:bg-indigo-500/40"></div>
              <h3 className="text-[11px] font-bold tracking-tight text-slate-900/40 dark:text-slate-400 uppercase">Recent Activity</h3>
              <div className="h-px flex-1 bg-slate-200/60 dark:bg-slate-800"></div>
            </div>

            {/* Activity Section */}
            <Card noPadding className="overflow-hidden border-0 bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 dark:bg-transparent dark:shadow-none dark:ring-0">
              <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800">
                 <div>
                  <h3 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white uppercase">System Events</h3>
                  <p className="text-[11px] text-slate-500 mt-1 font-bold tracking-tight opacity-60 uppercase">Real-time lifecycle telemetry</p>
                 </div>
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   onClick={() => router.push('/plugins')} 
                   className="text-[11px] font-bold tracking-tight px-4 group text-indigo-600 bg-indigo-50/50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all dark:text-indigo-400 dark:bg-transparent dark:hover:bg-slate-800 uppercase"
                 >
                    View All <FrameworkIcons.ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                 </Button>
              </div>
              
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                <Slot name="admin.dashboard.main" />
                
                {!hasMainContent && activity.length > 0 && (
                  activity.slice(0, 6).map((item) => (
                    <div key={item.id} className="px-8 py-5 flex items-start gap-4 group transition-all duration-300 hover:bg-indigo-50/30 dark:hover:bg-slate-800/30">
                      <div className={`mt-1 p-2.5 rounded-xl transition-all duration-300 ${
                        item.level === 'ERROR' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' :
                        item.level === 'WARN' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                        'bg-slate-50 border border-slate-200 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 group-hover:shadow-lg group-hover:shadow-indigo-600/20 dark:bg-slate-800 dark:border-transparent dark:text-indigo-400 dark:group-hover:bg-indigo-500 dark:group-hover:text-white'
                      }`}>
                        <FrameworkIcons.Terminal size={14} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <p className="text-[13px] font-bold truncate leading-relaxed text-slate-700 group-hover:text-slate-900 dark:text-slate-200 dark:group-hover:text-white tracking-tight">
                            {item.title}
                          </p>
                          <span className="text-[9px] font-bold tracking-tight whitespace-nowrap px-2 py-1 rounded-md bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 uppercase">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] font-bold tracking-tight opacity-40 text-slate-900 dark:text-slate-400 uppercase">Source:</span>
                          <span className="text-[10px] font-bold tracking-tight transition-colors text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-white uppercase">
                            {item.plugin ? (item.plugin.charAt(0).toUpperCase() + item.plugin.slice(1)) : 'System'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                ))}
                
                {!hasMainContent && activity.length === 0 && !loadingActivity && (
                  <div className="py-20 flex flex-col items-center justify-center text-center">
                     <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center mb-4">
                       <FrameworkIcons.Search size={24} className="text-slate-300" />
                     </div>
                     <p className="text-[11px] font-semibold tracking-wide text-slate-500">No telemetry recorded yet</p>
                  </div>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Slot name="admin.dashboard.widgets" />
            </div>
          </div>

          {/* Right Sidebar - Dynamic Content */}
          <div className="space-y-6">
            <Slot name="admin.dashboard.sidebar" />
            
            <Card title="Support & Docs">
               <div className="space-y-4">
                  <div className="p-5 bg-indigo-50 dark:bg-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/10">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed italic">
                      "Need help scaling your framework? Check the documentation for architecture best practices."
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full justify-between group"
                    as="a"
                    href={AdminConstants.ROUTES.SETTINGS.FRAMEWORK}
                  >
                     Developer Guide
                     <FrameworkIcons.ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <div className="pt-2 flex items-center justify-center gap-4 text-[10px] font-semibold tracking-wide text-slate-400">
                     <a href={AdminConstants.FRAMEWORK_RESOURCES.GITHUB} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Github</a>
                     <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                     <a href={AdminConstants.FRAMEWORK_RESOURCES.DISCORD} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Discord</a>
                     <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                     <a href={AdminConstants.FRAMEWORK_RESOURCES.TWITTER} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Twitter</a>
                  </div>
               </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Premium Footer */}
      <div className="p-10 border-t mt-auto bg-slate-50/50 border-slate-100 dark:bg-slate-950/20 dark:border-slate-800">
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <span className="text-[10px] font-bold tracking-tight text-slate-500 dark:text-slate-400 uppercase">
                  {AppEnv.APP_NAME} Infrastructure // v{AppEnv.APP_VERSION} {AppEnv.APP_CHANNEL}
                </span>
              </div>
              <p className="text-[9px] font-bold text-slate-400 italic uppercase tracking-tight">Connected to distributed cluster node. All systems operational.</p>
            </div>
            
            <div className="flex items-center gap-4 text-[10px] font-bold tracking-tight text-slate-400 uppercase">
              <a href={AdminConstants.FRAMEWORK_RESOURCES.DOCUMENTATION} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Documentation</a>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <a href={AdminConstants.FRAMEWORK_RESOURCES.FRAMEWORK_ROADMAP} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Framework Roadmap</a>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <a href={AdminConstants.FRAMEWORK_RESOURCES.SUPPORT} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
