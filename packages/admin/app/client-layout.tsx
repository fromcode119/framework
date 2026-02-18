"use client";

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Slot, PluginsProvider, useTranslation, usePlugins } from '@fromcode/react';
import { ThemeProvider, useTheme } from '@/components/theme-context';
import * as SharedComponents from '@/components';
import Sidebar from './sidebar';
import PluginLoader from './plugin-loader';
import { FrameworkIcons } from '@/lib/icons';
import { Dropdown } from '@/components/ui/dropdown';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { api } from '@/lib/api';
import { API_BASE_URL, ENDPOINTS } from '@/lib/constants';
import { Loader } from '@/components/ui/loader';
import { purgeAuth } from '@/lib/auth-utils';

const { 
  Menu = () => null, 
  Search = () => null, 
  Sun = () => null, 
  Moon = () => null, 
  Bell = () => null,
  User = () => null,
  Settings = () => null,
  Logout = () => null,
  Help = () => null
} = (FrameworkIcons || {}) as any;

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await api.get(ENDPOINTS.SYSTEM.HEALTH);
        setApiStatus('online');
        setIsMaintenance(data.maintenance === true);
      } catch (e) {
        setApiStatus('offline');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const userMenuItems = [
    { label: 'Profile Settings', icon: <User size={16} />, onClick: () => user?.id && router.push(`/users/${user.id}`) },
    ...(user?.roles?.includes('admin') ? [
      { label: 'System Settings', icon: <Settings size={16} />, onClick: () => router.push('/settings') }
    ] : []),
    { label: 'Help Center', icon: <Help size={16} />, onClick: () => window.open('https://docs.fromcode.com', '_blank') },
    { label: 'Logout Session', icon: <Logout size={16} />, onClick: logout, variant: 'danger' as const },
  ];
  
  return (
    <header className="flex h-16 border-b items-center justify-between px-6 lg:px-12 sticky top-0 z-[100] backdrop-blur-md transition-all duration-300 ease-in-out bg-white/80 border-slate-200 dark:bg-[#020617]/80 dark:border-slate-800">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu size={20}/>
        </button>
        <div className="flex items-center gap-3 rounded-full px-4 py-1.5 border transition-all duration-300 bg-slate-100/80 border-slate-200/60 shadow-inner dark:bg-slate-900 dark:border-slate-800">
           <div className={`h-2 w-2 rounded-full ${
             apiStatus === 'online' ? 'bg-green-500 animate-pulse' : 
             apiStatus === 'offline' ? 'bg-red-500' : 'bg-slate-400'
           }`} />
           <span className="text-[10px] font-semibold text-slate-500 tracking-wide">
             {apiStatus === 'online' ? 'System Online' : apiStatus === 'offline' ? 'System Offline' : 'Connecting...'}
           </span>
        </div>

        {isMaintenance && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
            <FrameworkIcons.Zap size={12} className="text-amber-500 animate-pulse" />
            <span className="text-[10px] font-semibold text-amber-600 tracking-wide">Maintenance Mode Active</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Slot name="admin.layout.header.right" />
        <button onClick={toggleTheme} className="text-slate-500 hover:text-indigo-500 transition-colors">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button className="text-slate-500 hover:text-indigo-500 transition-colors">
          <Bell size={18} />
        </button>
        
        <Dropdown 
          items={userMenuItems}
          header={
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wide text-indigo-600 dark:text-indigo-400">Connected Account</span>
              <div className="flex items-center gap-3 mt-1">
                 <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                 </div>
                 <div className="flex flex-col overflow-hidden">
                    <span className="text-[13px] font-bold truncate tracking-tight text-slate-900 dark:text-white">
                      {user?.email || 'Guest Account'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold tracking-wide">
                       {user?.roles?.[0] || 'Unassigned Role'}
                    </span>
                 </div>
              </div>
            </div>
          }
          trigger={
            <div className="flex items-center gap-3 hover:opacity-80 transition-opacity max-w-[200px]">
              <div className="flex flex-col items-end hidden sm:flex overflow-hidden">
                <span className="text-[11px] font-bold truncate w-full text-right text-slate-900 dark:text-slate-200">
                  {user?.email?.split('@')[0] || 'Unknown'}
                </span>
                <span className="text-[9px] text-slate-500 font-medium tracking-tight">
                  {user?.roles?.[0] || 'Guest'}
                </span>
              </div>
              <div className="h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-indigo-600/20 group-hover:scale-105 transition-transform">
                {user?.email?.charAt(0).toUpperCase() || 'A'}
              </div>
            </div>
          }
        />
      </div>
    </header>
  );
}

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { loadConfig } = usePlugins();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarInitialized, setIsSidebarInitialized] = useState(false);

  // Persist mobile sidebar open state
  useEffect(() => {
    const saved = localStorage.getItem('fc_sidebar_open');
    if (saved !== null) {
      setSidebarOpen(saved === 'true');
    }
    setIsSidebarInitialized(true);
  }, []);

  useEffect(() => {
    if (isSidebarInitialized) {
      localStorage.setItem('fc_sidebar_open', isSidebarOpen.toString());
    }
  }, [isSidebarOpen, isSidebarInitialized]);

  const pathname = usePathname();
  
  // Robust auth page detection
  const isAuthPage = React.useMemo(() => {
    return pathname?.includes('/login') || pathname?.includes('/setup');
  }, [pathname]);

  const isSetupPath = React.useMemo(() => {
     return pathname?.includes('/setup');
  }, [pathname]);
  
  // Load dynamic framework configuration (import maps, etc)
  useEffect(() => {
    if (!isAuthPage && user) {
      loadConfig(ENDPOINTS.SYSTEM.METADATA);
    }
  }, [loadConfig, user, isAuthPage]);

  const [isMini, setIsMini] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fc_sidebar_mini') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('fc_sidebar_mini', isMini.toString());
  }, [isMini]);

  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkInitialization = async () => {
      try {
        const data = await api.get(ENDPOINTS.AUTH.STATUS);
        const initialized = data.initialized;
        
        setIsInitialized(initialized);
        
        if (initialized === false && !isSetupPath) {
          console.log("[ClientLayout] System uninitialized -> setup");
          purgeAuth();
          window.location.href = '/setup';
        } else if (initialized === true && isSetupPath) {
          console.log("[ClientLayout] System initialized -> login");
          window.location.href = '/login';
        }
      } catch (e) {
        console.error("Initialization check failed", e);
        if (isInitialized === null) setIsInitialized(true);
      }
    };
    checkInitialization();
  }, [isSetupPath]); 

  // Guard: Redirect to login if user is missing and we aren't loading or on auth page
  useEffect(() => {
    if (isInitialized === true && !user && !isAuthPage && !isAuthLoading) {
      console.log("[ClientLayout] Guard: Moving to login");
      window.location.href = '/login';
    }
  }, [user, isInitialized, isAuthPage, isAuthLoading]);

  // Handle Unauthorized State (RBAC)
  if (user && !isAuthPage && !user.roles?.includes('admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020617]">
        <div className="max-w-md w-full p-12 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 shadow-xl shadow-rose-500/10">
            <FrameworkIcons.Zap size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Access Restricted</h1>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Your account <span className="font-bold text-indigo-500">{user.email}</span> does not have the required <span className="underline decoration-indigo-500/30">admin</span> privileges to access this console.
            </p>
          </div>
          <button 
            onClick={() => {
               purgeAuth();
               window.location.href = '/login';
            }}
            className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-semibold tracking-wide text-[11px] shadow-2xl hover:scale-[1.02] transition-transform"
          >
            Switch Account
          </button>
        </div>
      </div>
    );
  }

  // Show Loading state while checking initialization or auth
  if (isInitialized === null || (isAuthLoading && !isAuthPage)) {
    return (
      <div className="min-h-screen flex items-center justify-center transition-colors duration-500 bg-slate-50 dark:bg-[#020617]">
        <Loader label="Initializing Secure Session" />
      </div>
    );
  }

  // Prevent UI flashing for unauthenticated users
  if (!user && !isAuthPage) {
    return (
      <div className="min-h-screen flex items-center justify-center transition-colors duration-500 bg-slate-50 dark:bg-[#020617]">
        <Loader label="Forwarding to Authentication..." />
      </div>
    );
  }

  if (isAuthPage) {
    return (
      <div className="min-h-screen transition-colors duration-300 font-sans bg-slate-50 dark:bg-[#020617]">
        {children}
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col lg:flex-row transition-all duration-300 ease-in-out font-sans bg-slate-50 dark:bg-[#020617]">
      <PluginLoader />
      
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] lg:hidden animate-in fade-in duration-300" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        isMini={isMini}
        onMiniToggle={() => setIsMini(!isMini)}
      />
      
      <main className="flex-1 flex flex-col relative overflow-x-hidden min-h-screen transition-all duration-300 ease-in-out">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 flex flex-col transition-all duration-300">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const runtimeModules = React.useMemo(() => ({
    '@fromcode/admin': SharedComponents,
    '@fromcode/admin/components': SharedComponents
  }), []);

  // Expose components for the dynamic import map bridge
  if (typeof window !== 'undefined') {
    (window as any).FromcodeAdmin = SharedComponents;
  }

  return (
    <PluginsProvider 
      apiUrl={API_BASE_URL} 
      runtimeModules={runtimeModules}
    >
      <ThemeProvider>
        <LayoutContent>
          {children}
        </LayoutContent>
      </ThemeProvider>
    </PluginsProvider>
  );
}
