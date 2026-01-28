"use client";

import React, { useEffect, useState } from 'react';
import { Slot, usePlugins } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { useAuth } from '@/components/AuthContext';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import Cookies from 'js-cookie';
import { FrameworkIcons } from '@/lib/icons';

export default function AdminPage() {
  const { theme } = useTheme();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { slots, refreshVersion } = usePlugins();
  const [stats, setStats] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [activePluginsCount, setActivePluginsCount] = useState<number>(0);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  
  const hasMainContent = slots['admin.dashboard.main'] && slots['admin.dashboard.main'].length > 0;
  
  const userStats = stats.find(s => s.slug === 'users');
  const userCount = userStats ? String(userStats.count) : '0';

  useEffect(() => {
    if (isAuthLoading || !user) return;

    async function fetchStats() {
      try {
        const data = await api.get(ENDPOINTS.SYSTEM.STATS.COLLECTIONS);
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
        const data = await api.get(ENDPOINTS.PLUGINS.ACTIVE);
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
        const response = await api.get(ENDPOINTS.SYSTEM.LOGS);
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

    fetchStats();
    fetchPlugins();
    fetchActivity();
  }, [isAuthLoading, user, refreshVersion]);

  return (
    <div className="w-full pb-24 animate-in fade-in duration-500">
      {/* Premium Dashboard Header */}
      <div className={`sticky top-0 z-30 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.02),0_10px_40px_-10px_rgba(0,0,0,0.04)]'
      }`}>
        <div className="w-full px-6 lg:px-12 py-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 transition-transform hover:rotate-0 ${
                  theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-600 text-white'
                }`}>
                  <FrameworkIcons.Layout size={20} strokeWidth={2.5} />
                </div>
                <h1 className={`text-3xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                  Hello, {user?.email?.split('@')[0] || 'Administrator'}
                </h1>
              </div>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70">
                System status is <span className="text-emerald-500">Optimized</span> • {user?.email}
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className={`hidden sm:flex flex-col items-end pr-4 border-r ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Session</span>
                <span className={`text-[11px] font-bold ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>Authenticated via UI</span>
              </div>
              <div className={`px-5 py-3 rounded-2xl border flex items-center gap-3 text-[11px] font-black uppercase tracking-widest shadow-sm transition-all hover:scale-[1.02] ${
                theme === 'dark' 
                  ? 'bg-slate-900 border-slate-800 text-slate-300' 
                  : 'bg-white border-slate-100 text-slate-500 hover:text-indigo-600 hover:shadow-indigo-500/5'
              }`}>
                <FrameworkIcons.Clock size={16} className="text-indigo-500" />
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 lg:px-12 pt-12 space-y-8 pb-12">
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
            
            <div className="flex items-center gap-4">
              <div className={`h-8 w-1.5 rounded-full ${theme === 'dark' ? 'bg-indigo-500/40' : 'bg-indigo-600'}`}></div>
              <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900/40'}`}>Content Collections</h3>
              <div className={`h-px flex-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200/60'}`}></div>
            </div>

            {/* Main Resources Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {stats.filter(s => !s.system).map(s => (
                <div key={s.slug} className={`p-6 rounded-3xl border flex items-center justify-between transition-all hover:shadow-xl hover:shadow-indigo-500/5 group cursor-pointer ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100 shadow-lg shadow-slate-200/50'}`} onClick={() => window.location.href = `/content/${s.slug}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3.5 rounded-2xl transition-all duration-300 ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-600/20'}`}>
                      <FrameworkIcons.Database size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                         <p className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>{s.name || s.slug}</p>
                         {s.system && (
                           <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                             Platform
                           </span>
                         )}
                      </div>
                      <h4 className={`text-2xl font-black tracking-tight mt-0.5 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{s.count}</h4>
                    </div>
                  </div>
                  <div className="p-2 rounded-full h-10 w-10 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                    <FrameworkIcons.ArrowRight size={18} />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <div className={`h-8 w-1.5 rounded-full ${theme === 'dark' ? 'bg-indigo-500/40' : 'bg-indigo-600'}`}></div>
              <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900/40'}`}>Recent Activity</h3>
              <div className={`h-px flex-1 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200/60'}`}></div>
            </div>

            {/* Activity Section */}
            <Card noPadding className={`overflow-hidden border-0 ${theme === 'dark' ? '' : 'bg-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] ring-1 ring-slate-100'}`}>
              <div className={`flex items-center justify-between px-8 py-6 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                 <div>
                  <h3 className={`font-black uppercase tracking-tight text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>System Events</h3>
                  <p className="text-[11px] text-slate-500 mt-1 font-bold uppercase tracking-widest opacity-60">Real-time lifecycle telemetry</p>
                 </div>
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   onClick={() => window.location.href = '/plugins'} 
                   className={`text-[10px] font-black uppercase tracking-[0.15em] px-4 group ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600 bg-indigo-50/50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all'}`}
                 >
                    View All <FrameworkIcons.ArrowRight size={14} className="ml-2 group-hover:translate-x-1 transition-transform" />
                 </Button>
              </div>
              
              <div className={`divide-y ${theme === 'dark' ? 'divide-slate-800/50' : 'divide-slate-100'}`}>
                <Slot name="admin.dashboard.main" />
                
                {!hasMainContent && activity.length > 0 && (
                  activity.slice(0, 6).map((item) => (
                    <div key={item.id} className={`px-8 py-5 flex items-start gap-4 group transition-all duration-300 ${theme === 'dark' ? 'hover:bg-slate-800/30' : 'hover:bg-indigo-50/30'}`}>
                      <div className={`mt-1 p-2.5 rounded-xl transition-all duration-300 ${
                        item.level === 'ERROR' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' :
                        item.level === 'WARN' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' :
                        theme === 'dark' ? 'bg-slate-800 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white' : 'bg-slate-50 border border-slate-200 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 group-hover:shadow-lg group-hover:shadow-indigo-600/20'
                      }`}>
                        <FrameworkIcons.Terminal size={14} strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-4">
                          <p className={`text-[13px] font-bold truncate leading-relaxed ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700 group-hover:text-slate-900'}`}>
                            {item.title}
                          </p>
                          <span className={`text-[9px] font-black uppercase tracking-[0.1em] whitespace-nowrap px-2 py-1 rounded-md ${theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`text-[9px] font-black uppercase tracking-widest opacity-40 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-900'}`}>Source:</span>
                          <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${theme === 'dark' ? 'text-indigo-400 hover:text-white' : 'text-indigo-600 hover:text-indigo-800'}`}>{item.plugin || 'System'}</span>
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
                     <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">No telemetry recorded yet</p>
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
                  <Button variant="secondary" className="w-full justify-between group" as="a" href="/docs">
                     Developer Guide
                     <FrameworkIcons.ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <div className="pt-2 flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                     <a href="#" className="hover:text-indigo-500 transition-colors">Github</a>
                     <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                     <a href="#" className="hover:text-indigo-500 transition-colors">Discord</a>
                     <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                     <a href="#" className="hover:text-indigo-500 transition-colors">Twitter</a>
                  </div>
               </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Premium Footer */}
      <div className={`p-10 border-t mt-auto ${
        theme === 'dark' ? 'bg-slate-950/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="w-full px-6 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Core Infrastructure // Framework Alpha
                </span>
              </div>
              <p className="text-[9px] font-bold text-slate-400 italic">Connected to distributed cluster node. All systems operational.</p>
            </div>
            
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span className="hover:text-indigo-500 cursor-pointer transition-colors">Documentation</span>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="hover:text-indigo-500 cursor-pointer transition-colors">Framework Roadmap</span>
              <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              <span className="hover:text-indigo-500 cursor-pointer transition-colors">Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
