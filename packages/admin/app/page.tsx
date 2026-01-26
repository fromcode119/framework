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
        const data = await api.get(ENDPOINTS.SYSTEM.LOGS);
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
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Welcome back, {user?.email?.split('@')[0] || 'Admin'}
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            {user?.email} • Platform is healthy.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'}`}>
            <FrameworkIcons.Clock size={14} className="text-indigo-500" />
            Session: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Users" 
          value={loadingStats ? "..." : userCount} 
          icon={<FrameworkIcons.Users size={20} />} 
          trend={{ value: 10, isPositive: true }} 
        />
        <StatCard 
          title="Active Plugins" 
          value={String(activePluginsCount)} 
          icon={<FrameworkIcons.Plugins size={20} />} 
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         <Slot name="admin.dashboard.stats" />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Slot name="admin.dashboard.top" />
          
          {/* Main Resources Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.filter(s => !s.system).map(s => (
              <div key={s.slug} className={`p-6 rounded-2xl border flex items-center justify-between transition-all hover:shadow-md group ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl transition-colors ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'}`}>
                    <FrameworkIcons.Database size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                       <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{s.name || s.slug}</p>
                       {s.system && (
                         <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase tracking-tighter ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                           Platform
                         </span>
                       )}
                    </div>
                    <h4 className={`text-xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{s.count}</h4>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="p-2 rounded-full h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => window.location.href = `/content/${s.slug}`}>
                  <FrameworkIcons.ArrowRight size={16} />
                </Button>
              </div>
            ))}
          </div>

          {/* Activity Section */}
          <Card>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
               <CardHeader 
                title="System Activity" 
                subtitle="Recent lifecycle and audit events" 
               />
               <Button variant="ghost" size="sm" onClick={() => window.location.href = '/plugins'} className="text-xs font-bold text-indigo-500 group">
                  Audit All <FrameworkIcons.ArrowRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
               </Button>
            </div>
            
            <div className="space-y-4 p-6 pt-2">
              <Slot name="admin.dashboard.main" />
              
              {!hasMainContent && activity.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activity.slice(0, 5).map((item) => (
                    <div key={item.id} className="py-4 flex items-start gap-4 group">
                      <div className={`mt-1 p-2 rounded-lg ${
                        item.level === 'ERROR' ? 'bg-red-500/10 text-red-500' :
                        item.level === 'WARN' ? 'bg-amber-500/10 text-amber-500' :
                        theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        <FrameworkIcons.Terminal size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-bold truncate ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                            {item.title}
                          </p>
                          <span className="text-[10px] font-medium text-slate-500 whitespace-nowrap ml-2">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                          Log from <span className="font-bold text-indigo-500">{item.plugin || 'System'}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {!hasMainContent && activity.length === 0 && !loadingActivity && (
                <div className="py-12 flex flex-col items-center justify-center text-center">
                   <FrameworkIcons.Info size={32} className="text-slate-300 mb-2" />
                   <p className="text-sm text-slate-500 italic">No recent activity found.</p>
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
          
          <Card title="System Help">
             <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/10">
                <p className="text-xs text-slate-500 leading-relaxed">
                   Need help developing plugins? Check the <a href="/docs" className="text-indigo-500 font-bold hover:underline">documentation</a> or visit our developer portal.
                </p>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
