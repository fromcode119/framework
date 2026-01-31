"use client";

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Slot, PluginsProvider, useTranslation, usePlugins } from '@fromcode/react';
import { ThemeProvider, useTheme } from '@/components/ThemeContext';
import Sidebar from './Sidebar';
import PluginLoader from './PluginLoader';
import { FrameworkIcons } from '@/lib/icons';
import { Dropdown } from '@/components/ui/Dropdown';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { api } from '@/lib/api';
import { API_BASE_URL, ENDPOINTS } from '@/lib/constants';
import { Loader } from '@/components/ui/Loader';

// Destructure common icons for local use
const { 
  Menu, 
  Search, 
  Sun, 
  Moon, 
  Bell,
  User,
  Settings,
  Logout,
  Help
} = FrameworkIcons;

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
           <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
             {apiStatus === 'online' ? 'System Online' : apiStatus === 'offline' ? 'System Offline' : 'Connecting...'}
           </span>
        </div>

        {isMaintenance && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
            <FrameworkIcons.Zap size={12} className="text-amber-500 animate-pulse" />
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Maintenance Mode Active</span>
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
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Connected Account</span>
              <div className="flex items-center gap-3 mt-1">
                 <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white text-xs font-black shadow-lg">
                    {user?.email?.charAt(0).toUpperCase() || 'A'}
                 </div>
                 <div className="flex flex-col overflow-hidden">
                    <span className="text-[13px] font-black truncate tracking-tight text-slate-900 dark:text-white">
                      {user?.email || 'Guest Account'}
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
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
                <span className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter">
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
  const { registerSlotComponent, registerFieldComponent } = usePlugins();
  const translation = useTranslation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isMini, setIsMini] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fc_sidebar_mini') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('fc_sidebar_mini', isMini.toString());
  }, [isMini]);

  // Expose Framework utilities to the global scope for the plugin bridge
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).FrameworkIcons = FrameworkIcons;
      (window as any).Fromcode = {
        ...(window as any).Fromcode,
        registerSlotComponent,
        registerFieldComponent,
        useTranslation: () => translation,
        usePlugins
      };
    }
  }, [registerSlotComponent, registerFieldComponent, translation]);

  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isSetupPath = pathname === '/setup' || pathname.startsWith('/setup/');
  const isAuthPage = pathname === '/login' || isSetupPath;

  useEffect(() => {
    const checkInitialization = async () => {
      try {
        const data = await api.get(ENDPOINTS.AUTH.STATUS);
        setIsInitialized(data.initialized);
        
        if (data.initialized === false && !isSetupPath) {
          // Clear stale cookies if system isn't initialized
          document.cookie = "fc_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          document.cookie = "fc_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          
          router.replace('/setup');
        } else if (data.initialized === true && isSetupPath) {
          router.replace('/login');
        }
      } catch (e) {
        console.error("Failed to check system initialization status", e);
      }
    };
    checkInitialization();
  }, [pathname, router, isSetupPath]);

  // Handle Authentication Redirects
  useEffect(() => {
    if (isInitialized === true && !user && !isAuthPage && !isAuthLoading) {
      router.replace('/login');
    }
    
    // GUARD: If user is logged in but has no admin role, block access to the admin dashboard
    if (user && !isAuthPage && !user.roles?.includes('admin')) {
      // We'll show a "Forbidden" state or redirect to a landing page if one exists.
      // For now, we redirect to login (the auth logic will then prevent them as they're authenticated but not authorized)
      console.warn("Unauthorized access attempt: User lacks admin role", user.email);
    }
  }, [user, isInitialized, isAuthPage, isAuthLoading, router]);

  // Handle Unauthorized State
  if (user && !isAuthPage && !user.roles?.includes('admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020617]">
        <div className="max-w-md w-full p-12 text-center space-y-6">
          <div className="mx-auto w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center text-rose-500 shadow-xl shadow-rose-500/10">
            <FrameworkIcons.Zap size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Access Restricted</h1>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              Your account <span className="font-bold text-indigo-500">{user.email}</span> does not have the required <span className="underline decoration-indigo-500/30">admin</span> privileges to access this console.
            </p>
          </div>
          <button 
            onClick={() => {
               // Clear cookies and go to login
               document.cookie = "fc_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
               document.cookie = "fc_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
               window.location.href = '/login';
            }}
            className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl hover:scale-[1.02] transition-transform"
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
  return (
    <PluginsProvider apiUrl={API_BASE_URL}>
      <ThemeProvider>
        <LayoutContent>
          {children}
        </LayoutContent>
      </ThemeProvider>
    </PluginsProvider>
  );
}
