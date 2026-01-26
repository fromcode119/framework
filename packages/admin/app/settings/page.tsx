"use client";

import React, { useState } from 'react';
import { Slot } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { FrameworkIcons } from '@/lib/icons';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);
  const [maintenance, setMaintenance] = useState(false);

  const SettingRow = ({ icon: Icon, title, description, children }: any) => (
    <div className={`py-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b last:border-0 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
      <div className="flex gap-4">
        <div className={`p-2.5 rounded-xl h-fit ${theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
          <Icon size={20} />
        </div>
        <div>
          <h3 className={`font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>{title}</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            System Settings
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Global configuration and preferences for your platform.
          </p>
        </div>
        <Button size="lg" className="transform hover:scale-[1.02]">
          <FrameworkIcons.Save size={18} />
          <span>Save Changes</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Slot name="admin.settings.top" />
          
          <Card title="General Configuration">
            <SettingRow 
              icon={FrameworkIcons.Globe} 
              title="Site URL" 
              description="The primary address of your website for internal links and SEO."
            >
              <Input 
                defaultValue="https://vselenskiportal88.com"
                className="w-64"
              />
            </SettingRow>
            
            <SettingRow 
              icon={FrameworkIcons.Palette} 
              title="Theme Preferences" 
              description="Choose the visual style of your administration panel."
            >
              <div className={`flex p-1 rounded-lg ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-100'}`}>
                <button 
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${theme === 'light' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                >
                  Light
                </button>
                <button 
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}
                >
                  Dark
                </button>
              </div>
            </SettingRow>

            <SettingRow 
              icon={FrameworkIcons.Lock} 
              title="Two-Factor Authentication" 
              description="Add an extra layer of security to your admin account."
            >
              <Switch checked={twoFactor} onChange={setTwoFactor} />
            </SettingRow>

            <Slot name="admin.settings.general.after" />
          </Card>

          <Card title="Notifications">
            <SettingRow 
              icon={FrameworkIcons.Mail} 
              title="Email Alerts" 
              description="Receive weekly summaries and critical system alerts via email."
            >
              <Switch checked={notifications} onChange={setNotifications} />
            </SettingRow>

            <SettingRow 
              icon={FrameworkIcons.Smartphone} 
              title="Push Notifications" 
              description="Enable real-time updates directly in your browser or mobile device."
            >
              <Switch checked={false} onChange={() => {}} disabled label="Pro Feature" />
            </SettingRow>
          </Card>

          <Slot name="admin.settings.bottom" />
        </div>

        <div className="space-y-8">
          <Slot name="admin.settings.sidebar.top" />
          <Card title="System Status">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Database</span>
                <span className="flex items-center gap-2 text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Healthy
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>API Server</span>
                <span className="flex items-center gap-2 text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Storage</span>
                <span className="text-slate-400 text-xs font-bold">12.4 GB / 100 GB</span>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Maintenance Mode</span>
                  <Switch checked={maintenance} onChange={setMaintenance} />
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  When enabled, only administrators can access the portal frontend.
                </p>
              </div>
            </div>
          </Card>

          <Card title="Danger Zone">
            <div className="space-y-4">
              <p className="text-xs text-slate-500">The following actions are destructive and cannot be undone.</p>
              <Button variant="outline" className="w-full text-rose-500 border-rose-500/20 hover:bg-rose-500/10">
                <FrameworkIcons.Database size={16} />
                <span>Flush Cache</span>
              </Button>
              <Button variant="danger" className="w-full">
                <FrameworkIcons.Shield size={16} />
                <span>Reset System Configurations</span>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
