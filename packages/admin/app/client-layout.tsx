"use client";

import React, { useState, useEffect, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { Slot, PluginsProvider, ContextHooks } from '@fromcode119/react';
import { ThemeProvider } from '@/components/theme-context';
import { ThemeHooks } from '@/components/use-theme';
import * as SharedComponents from '@/components';
import Sidebar from './sidebar';
import PluginLoader from './plugin-loader';
import AdminExtensionLoader from './admin-extension-loader';
import { FrameworkIcons } from '@/lib/icons';
import { Dropdown } from '@/components/ui/dropdown';
import { usePathname, useRouter } from 'next/navigation';
import { AuthHooks } from '@/components/use-auth';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants';
import { AdminPathUtils } from '@/lib/admin-path';
import { Loader } from '@/components/ui/loader';
import { AuthUtils } from '@/lib/auth-utils';
import { TimezoneUtils } from '@/lib/timezone';
import { RuntimeConstants } from '@fromcode119/core/client';
import { AdminServices } from '@/lib/admin-services';

const adminServices = AdminServices.getInstance();

const { 
  Menu = () => null, 
  Search = () => null, 
  Sun = () => null, 
  Moon = () => null, 
  User = () => null,
  Settings = () => null,
  Logout = () => null,
  Help = () => null
} = (FrameworkIcons || {}) as any;

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, toggleTheme } = ThemeHooks.useTheme();
  const { user, logout } = AuthHooks.useAuth();
  const router = useRouter();
  const [apiStatus, setApiStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [isMaintenance, setIsMaintenance] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.HEALTH);
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
    { label: 'Profile Settings', icon: <User size={16} />, onClick: () => user?.id && router.push(AdminConstants.ROUTES.USERS.DETAIL(user.id)) },
    ...(user?.roles?.includes('admin') ? [
      { label: 'System Settings', icon: <Settings size={16} />, onClick: () => router.push(AdminConstants.ROUTES.SETTINGS.ROOT) }
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
        <button
          onClick={() => router.push(AdminConstants.ROUTES.MINIMAL)}
          className="h-9 w-9 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-cyan-500 hover:border-cyan-400/60 transition-colors inline-flex items-center justify-center"
          aria-label="Open Forge"
          title="Open Forge"
        >
          <FrameworkIcons.Zap size={14} />
        </button>
        <button onClick={toggleTheme} className="text-slate-500 hover:text-indigo-500 transition-colors">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
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
  const router = useRouter();
  const { theme } = ThemeHooks.useTheme();
  const { user, isLoading: isAuthLoading } = AuthHooks.useAuth();
  const { loadConfig, settings } = ContextHooks.usePlugins();
  const [, setTimezoneRenderVersion] = useState(0);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarInitialized, setIsSidebarInitialized] = useState(false);

  // Persist mobile sidebar open state
  useEffect(() => {
    const saved = adminServices.uiPreference.readSidebarOpen();
    if (saved !== null) {
      setSidebarOpen(saved);
    }
    setIsSidebarInitialized(true);
  }, []);

  useEffect(() => {
    if (isSidebarInitialized) {
      adminServices.uiPreference.writeSidebarOpen(isSidebarOpen);
    }
  }, [isSidebarOpen, isSidebarInitialized]);

  const pathname = usePathname();
  const normalizedPathname = React.useMemo(() => AdminPathUtils.stripBase(pathname || '/'), [pathname]);
  const isMinimalPath = normalizedPathname?.startsWith(AdminConstants.ROUTES.MINIMAL) || normalizedPathname?.startsWith('/minimal');
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return adminServices.uiPreference.readAdvancedMode();
  });
  
  // Robust auth page detection
  const isAuthPage = React.useMemo(() => {
    return AdminConstants.ROUTES.AUTH.PUBLIC.some((route) => normalizedPathname?.startsWith(route));
  }, [normalizedPathname]);

  const isSetupPath = React.useMemo(() => {
     return normalizedPathname?.startsWith(AdminConstants.ROUTES.AUTH.SETUP);
  }, [normalizedPathname]);
  
  // Load dynamic framework configuration (import maps, etc)
  useEffect(() => {
    if (!isAuthPage && user) {
      loadConfig(AdminConstants.ENDPOINTS.SYSTEM.METADATA);
    }
  }, [loadConfig, user, isAuthPage]);

  useLayoutEffect(() => {
    TimezoneUtils.applyDateLocaleTimezonePatch(String(settings?.timezone || ''));
    setTimezoneRenderVersion((value) => value + 1);
  }, [settings?.timezone]);

  const [isMini, setIsMini] = useState(() => {
    if (typeof window !== 'undefined') {
      return adminServices.uiPreference.readSidebarMini();
    }
    return false;
  });

  useEffect(() => {
    adminServices.uiPreference.writeSidebarMini(isMini);
  }, [isMini]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncMode = () => {
      setIsAdvancedMode(adminServices.uiPreference.readAdvancedMode());
    };
    window.addEventListener(RuntimeConstants.ADMIN_UI.EVENTS.MODE_CHANGED, syncMode as EventListener);
    window.addEventListener('storage', syncMode as EventListener);
    return () => {
      window.removeEventListener(RuntimeConstants.ADMIN_UI.EVENTS.MODE_CHANGED, syncMode as EventListener);
      window.removeEventListener('storage', syncMode as EventListener);
    };
  }, []);

  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);

  useEffect(() => {
    const checkInitialization = async () => {
      try {
        const data = await AdminApi.get(AdminConstants.ENDPOINTS.AUTH.STATUS);
        const initialized = data.initialized;
        
        setIsInitialized(initialized);
        
        if (initialized === false && !isSetupPath) {
          console.log("[ClientLayout] System uninitialized -> setup");
          AuthUtils.purgeAuth();
          router.push(AdminConstants.ROUTES.AUTH.SETUP);
        } else if (initialized === true && isSetupPath) {
          console.log("[ClientLayout] System initialized -> login");
          router.push(AdminConstants.ROUTES.AUTH.LOGIN);
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
      router.push(AdminConstants.ROUTES.AUTH.LOGIN);
    }
  }, [user, isInitialized, isAuthPage, isAuthLoading]);

  useEffect(() => {
    if (isAuthPage || !user || isInitialized !== true) return;
    if (isAdvancedMode) return;
    if (!isMinimalPath) {
      router.replace(AdminConstants.ROUTES.MINIMAL);
    }
  }, [isAuthPage, user, isInitialized, isAdvancedMode, isMinimalPath, router]);

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
               AuthUtils.purgeAuth();
               router.push(AdminConstants.ROUTES.AUTH.LOGIN);
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

  if (isMinimalPath) {
    return (
      <div className="min-h-screen transition-all duration-300 ease-in-out font-sans bg-slate-50 dark:bg-[#020617]">
        <AdminExtensionLoader />
        <main className="min-h-screen flex flex-col">
          {children}
        </main>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col lg:flex-row transition-all duration-300 ease-in-out font-sans bg-slate-50 dark:bg-[#020617]">
      <PluginLoader />
      <AdminExtensionLoader />
      
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
      
      <main className="flex-1 min-w-0 flex flex-col relative overflow-x-clip min-h-screen transition-all duration-300 ease-in-out">
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
  const adminRuntimeModule = React.useMemo(() => {
    const source = SharedComponents as Record<string, any>;
    const requiredExports = [
      'PluginPageHeader',
      'PluginOverviewCard',
      'PluginStatsList',
      'PluginChartCard',
      'PluginEmptyState',
      'MediaPicker',
      'Button',
      'Input',
      'TextArea',
      'Select',
      'TagField',
      'Loader',
      'Switch',
      'Card',
      'Badge',
      'ConfirmDialog',
      'PromptDialog',
      'DateTimePicker',
      'ColorPicker',
      'CodeEditor',
      'VisualMenuField',
      'PageHeading',
      'StatCard',
      'DataTable',
      'Icon',
      'ThemeProvider',
      'ThemeContext',
      'NotificationContext',
      'AdminServices'
    ];

    const bridge: Record<string, any> = {};
    requiredExports.forEach((key) => {
      bridge[key] = source[key];
    });

    Object.keys(source).forEach((key) => {
      if (!(key in bridge)) {
        bridge[key] = source[key];
      }
    });

    return bridge;
  }, []);

  const runtimeModules = React.useMemo(() => ({
    '@fromcode119/admin': adminRuntimeModule,
    '@fromcode119/admin/components': adminRuntimeModule
  }), [adminRuntimeModule]);

  // Pre-seed runtime module registry for deterministic bridge readiness.
  if (typeof window !== 'undefined') {
    const runtimeRegistry = ((window as any)[RuntimeConstants.GLOBALS.MODULES] ||= {});
    runtimeRegistry[RuntimeConstants.MODULE_NAMES.ADMIN] = adminRuntimeModule;
    runtimeRegistry[RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS] = adminRuntimeModule;
  }

  return (
    <PluginsProvider 
      apiUrl={AdminConstants.API_BASE_URL} 
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
