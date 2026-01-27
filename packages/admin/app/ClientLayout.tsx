"use client";

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Slot, PluginsProvider } from '@fromcode/react';
import { ThemeProvider, useTheme } from '@/components/ThemeContext';
import Sidebar from './Sidebar';
import PluginLoader from './PluginLoader';
import { FrameworkIcons } from '@/lib/icons';
import { Dropdown } from '@/components/ui/Dropdown';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { api } from '@/lib/api';
import { getIcon } from '@fromcode/react';
import { API_BASE_URL, ENDPOINTS } from '@/lib/constants';

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

function GlobalInitializer() {
  if (typeof window !== 'undefined') {
    (window as any).React = React;
    (window as any).ReactDOM = ReactDOM;
    
    // Register the stable framework icon set
    (window as any).FrameworkIcons = FrameworkIcons;
    (window as any).getIcon = getIcon;
    
    if (!(window as any)._framework_initialized) {
      console.log(`[Framework] Semantic icons initialized with ${Object.keys(FrameworkIcons).length} definitions.`);
      (window as any)._framework_initialized = true;
    }
  }
  return null;
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
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
    { label: user?.email || 'Admin User', icon: <User size={16} />, onClick: () => console.log('Profile') },
    { label: 'Settings', icon: <Settings size={16} />, onClick: () => console.log('Settings') },
    { label: 'Help Center', icon: <Help size={16} />, onClick: () => console.log('Help') },
    { label: 'Logout', icon: <Logout size={16} />, onClick: logout, variant: 'danger' as const },
  ];
  
  return (
    <header className={`flex h-16 border-b items-center justify-between px-6 lg:px-8 sticky top-0 z-40 backdrop-blur-md ${theme === 'dark' ? 'bg-[#020617]/80 border-slate-800' : 'bg-white/80 border-slate-200'}`}>
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu size={20}/>
        </button>
        <div className={`flex items-center gap-3 rounded-full px-4 py-1.5 border transition-all duration-300 ${
          theme === 'dark' 
            ? 'bg-slate-900 border-slate-800' 
            : 'bg-slate-100/80 border-slate-200/60 shadow-inner'
        }`}>
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
          trigger={
            <div className="flex items-center gap-3 cursor-pointer group max-w-[200px]">
              <div className="flex flex-col items-end hidden sm:flex overflow-hidden">
                <span className={`text-[11px] font-bold truncate w-full text-right ${theme === 'dark' ? 'text-slate-200' : 'text-slate-900'}`}>
                  {user?.email?.split('@')[0] || 'Admin User'}
                </span>
                <span className="text-[9px] text-slate-500 font-medium uppercase tracking-tighter">
                  {user?.roles?.[0] || 'Super Admin'}
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
  const [isSidebarOpen, setSidebarOpen] = useState(false);
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
  }, [user, isInitialized, isAuthPage, isAuthLoading, router]);

  // Show Loading state while checking initialization or auth
  if (isInitialized === null || (isAuthLoading && !isAuthPage)) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Loading Platform...</p>
        </div>
      </div>
    );
  }

  if (isAuthPage) {
    return (
      <div className={`min-h-screen transition-colors duration-300 font-sans ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
        {children}
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen flex flex-col lg:flex-row transition-colors duration-300 font-sans ${theme === 'dark' ? 'bg-[#020617]' : 'bg-slate-50'}`}>
      <GlobalInitializer />
      <PluginLoader />
      
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 flex flex-col relative overflow-x-hidden min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <div className="p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-8 pb-24">
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
