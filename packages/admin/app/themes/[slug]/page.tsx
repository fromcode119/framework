"use client";

import React, { use, useState, useEffect } from 'react';
import { usePlugins } from '@fromcode119/react';
import { useTheme } from '../../../components/theme-context';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Switch } from '../../../components/ui/switch';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { FrameworkIcons } from '../../../lib/icons';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { api } from '../../../lib/api';
import { ENDPOINTS } from '../../../lib/constants';
import { useNotify } from '../../../components/notification-context';

const CORE_LAYOUTS = [
    { id: 'core/layouts/Default', label: 'Default Page', description: 'Used for standard content pages.' },
    { id: 'core/layouts/Blank', label: 'Blank Canvas', description: 'Minimal layout without header or footer.' },
    { id: 'core/layouts/Home', label: 'Homepage', description: 'Specific layout for the front page.' },
    { id: 'core/layouts/auth', label: 'Authentication', description: 'Layout for login and register screens.' }
];

interface Theme {
  slug: string;
  name: string;
  version: string;
  description?: string;
  state: 'active' | 'inactive';
  author?: string;
  variables?: Record<string, string>;
  variableSchema?: Record<string, {
    label: string;
    type: 'color' | 'text' | 'number' | 'select' | 'font' | 'image';
    description?: string;
    options?: { label: string; value: string }[];
    group?: string;
  }>;
  layouts?: { name: string; label: string; description?: string }[];
  overrides?: { name: string; component: string; priority?: number }[];
}

const GOOGLE_FONTS = [
    { label: 'Inter', value: 'Inter, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Playfair Display', value: '"Playfair Display", serif' },
    { label: 'Lora', value: 'Lora, serif' },
    { label: 'Manrope', value: 'Manrope, sans-serif' },
    { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'System sans', value: 'system-ui, -apple-system, sans-serif' }
];

export default function ThemeSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const { notify } = useNotify();
  const { triggerRefresh, refreshVersion } = usePlugins();
  const searchParams = useSearchParams();
  const [themeDetail, setThemeDetail] = useState<Theme | null>(null);
  const [marketplaceVersion, setMarketplaceVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReseeding, setIsReseeding] = useState(false);
  const [isResettingTheme, setIsResettingTheme] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRunSeedsConfirmOpen, setIsRunSeedsConfirmOpen] = useState(false);
  const [isResetThemeConfirmOpen, setIsResetThemeConfirmOpen] = useState(false);
  const [dbConfig, setDbConfig] = useState<any>({});
  const [tempVariables, setTempVariables] = useState<Record<string, string>>({});
  const [tempLayouts, setTempLayouts] = useState<Record<string, string>>({});
  const { theme: adminTheme } = useTheme();

  const fetchTheme = async () => {
    try {
      const [installedData, marketplaceData, configData] = await Promise.all([
        api.get(ENDPOINTS.THEMES.LIST),
        api.get(ENDPOINTS.THEMES.MARKETPLACE),
        api.get(ENDPOINTS.THEMES.CONFIG(slug))
      ]);
      
      const found = installedData.find((t: any) => t.slug === slug);
      if (found) {
        setThemeDetail(found);
        setDbConfig(configData.config || {});
        
        // Initialize temp variables with merged values (manifest + db)
        setTempVariables({
            ...(found.variables || {}),
            ...(configData.config?.variables || {})
        });

        // Initialize temp layouts from db config
        setTempLayouts(configData.config?.layouts || {});
        
        // Check for updates in marketplace
        const marketplace = Array.isArray(marketplaceData) ? marketplaceData : (marketplaceData.themes || []);
        const marketMatch = marketplace.find((r: any) => r.slug === slug);
        if (marketMatch) {
          setMarketplaceVersion(marketMatch.version);
        }
      } else {
        router.push('/themes');
      }
    } catch (err) {
      console.error("Failed to fetch theme detail", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTheme();
  }, [slug, router, refreshVersion]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'settings' || tab === 'overview') {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const handleActivate = async () => {
    if (!themeDetail) return;
    try {
      await api.post(ENDPOINTS.THEMES.ACTIVATE(themeDetail.slug));
      notify('success', 'Theme Activated', `${themeDetail.name} is now active.`);
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Activation Failed', err.message);
    }
  };

  const handleUpdate = async () => {
    if (!themeDetail) return;
    setIsUpdating(true);
    try {
      notify('info', 'Updating...', `Downloading latest version of ${themeDetail.slug}...`);
      await api.post(ENDPOINTS.THEMES.INSTALL(themeDetail.slug));
      notify('success', 'Updated', `Theme ${themeDetail.name} has been updated.`);
      await fetchTheme();
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Update Failed', err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!themeDetail) return;
    setIsSaving(true);
    try {
      await api.post(ENDPOINTS.THEMES.CONFIG(slug), {
        ...dbConfig,
        variables: tempVariables,
        layouts: tempLayouts
      });
      notify('success', 'Configuration Saved', 'Visual protocols updated successfully.');
      await fetchTheme();
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Save Failed', err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteConfirm = () => {
    if (!themeDetail) return;
    setIsDeleteConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!themeDetail) return;
    setIsDeleting(true);
    setIsDeleteConfirmOpen(false);
    try {
      await api.delete(ENDPOINTS.THEMES.DELETE(themeDetail.slug));
      notify('success', 'Theme Deleted', `${themeDetail.name} has been removed.`);
      router.push('/themes');
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Deletion Failed', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openRunSeedsConfirm = () => {
    if (!themeDetail) return;
    setIsRunSeedsConfirmOpen(true);
  };

  const handleRunSeeds = async () => {
    if (!themeDetail) return;
    setIsRunSeedsConfirmOpen(false);
    setIsReseeding(true);
    try {
      await api.post(ENDPOINTS.THEMES.RESET(themeDetail.slug), { runSeeds: true, resetConfig: false });
      notify('success', 'Seeds Executed', `Seed script executed for ${themeDetail.name}.`);
      await fetchTheme();
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Seed Failed', err.message);
    } finally {
      setIsReseeding(false);
    }
  };

  const openResetThemeConfirm = () => {
    if (!themeDetail) return;
    setIsResetThemeConfirmOpen(true);
  };

  const handleResetTheme = async () => {
    if (!themeDetail) return;
    setIsResetThemeConfirmOpen(false);
    setIsResettingTheme(true);
    try {
      await api.post(ENDPOINTS.THEMES.RESET(themeDetail.slug), { runSeeds: true, resetConfig: true });
      notify('success', 'Theme Reset', `${themeDetail.name} config reset and seeds executed.`);
      await fetchTheme();
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Reset Failed', err.message);
    } finally {
      setIsResettingTheme(false);
    }
  };

  const handleVariableChange = (key: string, value: string) => {
    setTempVariables(prev => ({ ...prev, [key]: value }));
  };

  const handleLayoutChange = (key: string, value: string) => {
    setTempLayouts(prev => ({ ...prev, [key]: value }));
  };

  const handleTabChange = (tabId: 'overview' | 'settings') => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tabId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <FrameworkIcons.Loader className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!themeDetail) return null;

  // Group variables by schema group
  const groupedVariables: Record<string, string[]> = { 'General': [] };
  const allVarKeys = Object.keys(tempVariables);

  allVarKeys.forEach(key => {
    const group = themeDetail?.variableSchema?.[key]?.group || 'General';
    if (!groupedVariables[group]) groupedVariables[group] = [];
    groupedVariables[group].push(key);
  });

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-6">
        <Link 
          href="/themes"
          className={`h-11 w-11 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg ${adminTheme === 'dark' ? 'bg-slate-900 text-slate-400 hover:text-white ring-1 ring-white/10' : 'bg-white text-slate-500 hover:text-indigo-600 shadow-slate-200/50 hover:shadow-indigo-500/10'}`}
        >
          <FrameworkIcons.Left size={20} strokeWidth={2.5} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
             <h1 className={`text-3xl font-bold tracking-tight truncate ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
               {themeDetail.name}
             </h1>
             <Badge variant={themeDetail.state === 'active' ? 'success' : 'gray'}>
                {themeDetail.state}
             </Badge>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${adminTheme === 'dark' ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{themeDetail.slug}</span>
            <span className="text-slate-500 opacity-30">•</span>
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${marketplaceVersion && marketplaceVersion !== themeDetail.version ? 'text-amber-500' : 'text-slate-400'}`}>
              Version {themeDetail.version}
            </span>
            {marketplaceVersion && marketplaceVersion !== themeDetail.version && (
              <button 
                onClick={handleUpdate}
                disabled={isUpdating}
                className="ml-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wide rounded-lg transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                {isUpdating ? <FrameworkIcons.Loader size={10} className="animate-spin" /> : <FrameworkIcons.Zap size={10} />}
                {isUpdating ? 'Updating...' : 'Update Available'}
              </button>
            )}
          </div>
        </div>
        
        {activeTab === 'settings' && (
           <button 
              onClick={handleSaveConfig}
              disabled={isSaving}
              className={`h-12 px-8 rounded-2xl flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide transition-all duration-300 shadow-xl active:scale-95 disabled:opacity-50 ${adminTheme === 'dark' ? 'bg-indigo-600 text-white shadow-indigo-600/20 hover:bg-indigo-500' : 'bg-indigo-600 text-white shadow-indigo-600/10 hover:bg-indigo-700'}`}
           >
              {isSaving ? <FrameworkIcons.Loader size={16} className="animate-spin" /> : <FrameworkIcons.Zap size={16} />}
              Apply Architecture Update
           </button>
        )}
      </div>
      
      <div className={`flex gap-2 p-1.5 rounded-2xl w-fit backdrop-blur-xl border transition-all duration-300 ${
        adminTheme === 'dark' 
          ? 'bg-slate-900/50 border-white/5' 
          : 'bg-slate-100/80 border-slate-200/60 shadow-sm'
      }`}>
          {[
            { id: 'overview', label: 'Overview', icon: FrameworkIcons.Palette },
            { id: 'settings', label: 'Theme Builder', icon: FrameworkIcons.Box }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => handleTabChange(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-all rounded-xl ${activeTab === tab.id 
                ? (adminTheme === 'dark' 
                    ? 'bg-slate-800 text-indigo-400 shadow-xl shadow-indigo-500/10' 
                    : 'bg-white text-indigo-600 shadow-lg shadow-indigo-500/5 ring-1 ring-slate-200/50')
                : (adminTheme === 'dark'
                    ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-white/50')}`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
      </div>

      <div className="w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
          <div className="lg:col-span-2 space-y-8">
            {activeTab === 'overview' && (
              <Card className={`border-0 relative overflow-hidden p-8 transition-all duration-500 rounded-[2.5rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
                <div className="flex items-start gap-8">
                  <div className={`h-24 w-24 rounded-[2rem] flex items-center justify-center shadow-2xl transition-transform hover:scale-105 ${adminTheme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
                     <FrameworkIcons.Palette size={48} strokeWidth={1} />
                  </div>
                  <div className="flex-1 space-y-4">
                    <Badge variant="blue" className="px-3 py-1 font-semibold uppercase tracking-wide text-[10px] rounded-lg">
                      Visual Package
                    </Badge>
                    <p className={`text-xl leading-relaxed font-medium italic ${adminTheme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                      {themeDetail.description || "No description provided for this theme."}
                    </p>
                  </div>
                </div>

                <div className={`mt-10 pt-8 border-t ${adminTheme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'}`}>
                   <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-6">Layout Architectures</h4>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {themeDetail.layouts?.map(layout => (
                          <div key={layout.name} className={`p-6 rounded-3xl border transition-all ${adminTheme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50/50 border-slate-100 shadow-sm'}`}>
                             <div className={`text-sm font-semibold mb-1 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{layout.label}</div>
                             <p className="text-[11px] text-slate-500 font-medium italic">{layout.description || 'Standard platform optimized layout.'}</p>
                          </div>
                      ))}
                   </div>
                </div>

                <div className={`mt-10 pt-8 border-t ${adminTheme === 'dark' ? 'border-slate-800/80' : 'border-slate-100'} flex items-center justify-between`}>
                  <div className="space-y-1">
                    <div className={`text-[10px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Deployment Status</div>
                    <div className="flex items-center gap-3">
                      <div className={`h-3 w-3 rounded-full ${themeDetail.state === 'active' ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.3)]' : 'bg-slate-500'}`} />
                      <span className={`text-sm font-semibold uppercase tracking-tight ${themeDetail.state === 'active' ? 'text-green-500' : 'text-slate-500'}`}>
                        System {themeDetail.state}
                      </span>
                    </div>
                  </div>
                  {themeDetail.state !== 'active' && (
                      <button 
                          onClick={handleActivate}
                          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all shadow-lg shadow-indigo-600/10 active:scale-95"
                      >
                          Activate Environment
                      </button>
                  )}
                </div>
              </Card>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-8">
                 {Object.entries(groupedVariables).map(([group, keys]) => keys.length > 0 && (
                     <Card key={group} className={`border-0 p-10 rounded-[2.5rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
                        <div className="flex items-center gap-4 mb-10">
                            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                            <FrameworkIcons.Settings size={20} />
                            </div>
                            <div>
                            <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                {group} Protocols
                            </h3>
                            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Configure {group.toLowerCase()} design variables.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            {keys.map(key => {
                                const schema = themeDetail.variableSchema?.[key];
                                const value = tempVariables[key];
                                const type = schema?.type || (value?.startsWith('#') ? 'color' : 'text');

                                return (
                                    <div key={key} className={`flex items-center justify-between p-7 rounded-[2.5rem] transition-all duration-500 border group ${
                                        adminTheme === 'dark' 
                                            ? 'bg-slate-800/30 border-white/5 focus-within:border-indigo-500/30' 
                                            : 'bg-white border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] focus-within:shadow-xl focus-within:shadow-indigo-500/10 focus-within:border-indigo-500/20'
                                    }`}>
                                        <div className="flex-1 mr-8">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={`text-[10px] font-semibold uppercase tracking-wide text-slate-500`}>{schema?.label || key}</div>
                                                {schema?.description && (
                                                    <div className="group/tip relative flex items-center">
                                                        <FrameworkIcons.Info size={12} className="text-slate-500 cursor-help" />
                                                        <div className="absolute left-full ml-2 w-48 p-3 rounded-xl bg-slate-900 text-[10px] text-slate-300 opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50 font-medium">
                                                            {schema.description}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {type === 'select' ? (
                                                <select 
                                                    value={value}
                                                    onChange={e => handleVariableChange(key, e.target.value)}
                                                    className={`w-full bg-transparent border-0 p-0 text-sm font-semibold focus:ring-0 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                                                >
                                                    {schema?.options?.map(opt => (
                                                        <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
                                                    ))}
                                                </select>
                                            ) : type === 'font' ? (
                                                <div className="flex items-center gap-4">
                                                     <div className="flex-1 relative group/font">
                                                        <input 
                                                            type="text"
                                                            value={value}
                                                            onChange={e => handleVariableChange(key, e.target.value)}
                                                            placeholder="Inter, sans-serif"
                                                            list={`fonts-${key}`}
                                                            className={`w-full bg-transparent border-0 p-0 text-sm font-semibold focus:ring-0 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                                                        />
                                                        <datalist id={`fonts-${key}`}>
                                                            {GOOGLE_FONTS.map(f => (
                                                                <option key={f.value} value={f.value}>{f.label}</option>
                                                            ))}
                                                        </datalist>
                                                     </div>
                                                    <div className={`text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase tracking-wide min-w-[40px] text-center`} style={{ fontFamily: value }}>
                                                        ABC
                                                    </div>
                                                </div>
                                            ) : type === 'image' ? (
                                                <div className="flex items-center gap-4">
                                                     <input 
                                                        type="text"
                                                        value={value}
                                                        onChange={e => handleVariableChange(key, e.target.value)}
                                                        placeholder="https://..."
                                                        className={`flex-1 bg-transparent border-0 p-0 text-sm font-semibold focus:ring-0 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                                                    />
                                                    {value && (
                                                        <img src={value} className="h-8 w-8 rounded-lg object-cover ring-2 ring-indigo-500/20" alt="Preview" />
                                                    )}
                                                </div>
                                            ) : (
                                                <input 
                                                    type={type === 'number' ? 'number' : 'text'}
                                                    value={value}
                                                    onChange={e => handleVariableChange(key, e.target.value)}
                                                    className={`w-full bg-transparent border-0 p-0 text-sm font-semibold focus:ring-0 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                                                />
                                            )}
                                        </div>

                                        {type === 'color' && (
                                            <div className="relative group">
                                                <input 
                                                    type="color"
                                                    value={value}
                                                    onChange={e => handleVariableChange(key, e.target.value)}
                                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                                />
                                                <div className={`w-12 h-12 rounded-2xl shadow-2xl border-4 transform rotate-3 transition-transform group-hover:rotate-0 ${
                                                    adminTheme === 'dark' ? 'border-slate-800' : 'border-white ring-1 ring-slate-200/50'
                                                }`} style={{ backgroundColor: value }} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                     </Card>
                 ))}

                 {/* Layout Mappings */}
                 <Card className={`border-0 p-10 rounded-[2.5rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
                    <div className="flex items-center gap-4 mb-10">
                        <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                           <FrameworkIcons.Box size={20} />
                        </div>
                        <div>
                           <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                               Layout Protocols
                           </h3>
                           <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Map platform layouts to theme implementations.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {CORE_LAYOUTS.map(layout => {
                            const activeLayout = themeDetail.layouts?.find(l => l.name === tempLayouts[layout.id]);
                            
                            return (
                                <div key={layout.id} className={`flex flex-col p-6 rounded-[2rem] transition-all duration-500 border ${
                                    adminTheme === 'dark' 
                                        ? 'bg-slate-800/30 border-white/5 focus-within:border-purple-500/30' 
                                        : 'bg-white border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.02)] focus-within:shadow-xl focus-within:shadow-purple-500/10 focus-within:border-purple-500/20'
                                }`}>
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{layout.label}</div>
                                            <p className="text-[9px] text-slate-400 font-medium italic leading-tight max-w-[150px]">
                                                {layout.description}
                                            </p>
                                        </div>
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${activeLayout ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                                            <FrameworkIcons.Box size={14} />
                                        </div>
                                    </div>

                                    <div className="mt-auto">
                                        <select 
                                            value={tempLayouts[layout.id] || ''}
                                            onChange={e => handleLayoutChange(layout.id, e.target.value)}
                                            className={`w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-xs font-semibold focus:ring-0 ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}
                                        >
                                            <option value="" className="bg-slate-900">System Default</option>
                                            {themeDetail.layouts?.map(l => (
                                                <option key={l.name} value={l.name} className="bg-slate-900">{l.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                 </Card>

                 {/* Component Overrides */}
                 {themeDetail.overrides && themeDetail.overrides.length > 0 && (
                    <Card className={`border-0 p-10 rounded-[2.5rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
                        <div className="flex items-center gap-4 mb-10">
                            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                               <FrameworkIcons.Zap size={20} />
                            </div>
                            <div>
                               <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                   UI Overrides
                               </h3>
                               <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight mt-1">Components hard-coded for replacement by this theme.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {themeDetail.overrides.map((o) => (
                                <div key={o.name} className={`p-5 rounded-3xl border flex items-center gap-3 ${adminTheme === 'dark' ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50/50 border-slate-100 shadow-sm'}`}>
                                    <div className="h-6 w-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                                       <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    </div>
                                    <div className={`text-[10px] font-semibold uppercase tracking-wide ${adminTheme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                                        {o.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                 )}
                 
                 {!allVarKeys.length && (
                   <Card className={`border-0 p-20 flex flex-col items-center justify-center rounded-[3rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
                      <FrameworkIcons.Info size={32} className="text-slate-300 mb-4" />
                      <p className="text-slate-500 font-semibold uppercase tracking-wide text-[10px]">No configurable protocols found</p>
                   </Card>
                 )}
              </div>
            )}
          </div>

          <div className="space-y-8">
            <Card className={`border-0 p-8 rounded-[2rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
              <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] mb-8 ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Metadata Artifacts
              </h3>
              <div className="space-y-6">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Architect</span>
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${adminTheme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                          {themeDetail.author || 'Fromcode Official'}
                      </span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Marketplace Version</span>
                      <span className={`text-[11px] font-semibold ${adminTheme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                         v{themeDetail.version}
                      </span>
                   </div>
              </div>
              
              {marketplaceVersion && marketplaceVersion !== themeDetail.version && (
                <div className={`mt-8 pt-8 border-t ${adminTheme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                  <button 
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <FrameworkIcons.Clock size={14} />
                    {isUpdating ? 'Synchronizing...' : `Upgrade to v${marketplaceVersion}`}
                  </button>
                </div>
              )}
            </Card>

            <Card className={`border-0 p-8 rounded-[2rem] overflow-hidden relative ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
               <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] mb-6 ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Visual Preview
              </h3>
              <div 
                className="w-full aspect-video rounded-2xl border-2 border-dashed flex items-center justify-center flex-col gap-3 group overflow-hidden relative"
                style={{ 
                    borderColor: tempVariables.primary || '#6366f1',
                    backgroundColor: (tempVariables.background || '#000') + '22'
                }}
              >
                  <div 
                    className="absolute inset-0 opacity-20 transition-transform group-hover:scale-110 duration-1000"
                    style={{ backgroundColor: tempVariables.primary || '#6366f1' }}
                  />
                  <FrameworkIcons.Eye size={24} className="text-slate-500 relative z-10" />
                  <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-500/50 relative z-10">Real-time Simulation Node</p>
                  
                  <div className="mt-4 flex gap-2 relative z-10">
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tempVariables.primary }} />
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tempVariables.background }} />
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tempVariables.foreground }} />
                  </div>
              </div>
            </Card>

            <Card className={`border-0 p-8 rounded-[2rem] ${adminTheme === 'dark' ? 'bg-slate-900/40' : 'bg-white shadow-xl shadow-slate-200/50'}`}>
              <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] mb-6 ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Theme Maintenance
              </h3>
              <div className="space-y-3">
                <button
                  onClick={openRunSeedsConfirm}
                  disabled={isReseeding || isResettingTheme}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isReseeding ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Refresh size={14} />}
                  {isReseeding ? 'Running Seeds...' : 'Run Seeds'}
                </button>
                <button
                  onClick={openResetThemeConfirm}
                  disabled={isReseeding || isResettingTheme}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-semibold uppercase tracking-wide rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isResettingTheme ? <FrameworkIcons.Loader size={14} className="animate-spin" /> : <FrameworkIcons.Warning size={14} />}
                  {isResettingTheme ? 'Resetting Theme...' : 'Reset Theme + Seeds'}
                </button>
              </div>
              <p className={`mt-4 text-[10px] font-bold leading-relaxed ${adminTheme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                Run Seeds replays theme seed data. Reset Theme + Seeds clears saved theme config and replays seeds.
              </p>
            </Card>

            {themeDetail.state !== 'active' && (
              <Card className={`border-0 p-10 rounded-[2rem] ${adminTheme === 'dark' ? 'bg-red-500/10 border border-red-500/20 shadow-2xl shadow-red-500/5' : 'bg-red-50 border border-red-100 shadow-sm'}`}>
                  <div className="flex items-center gap-3 mb-6">
                    <FrameworkIcons.Warning size={18} className="text-red-500" />
                    <h3 className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${adminTheme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                        System Purge
                    </h3>
                  </div>
                  <p className={`text-[11px] font-bold leading-relaxed mb-8 ${adminTheme === 'dark' ? 'text-red-300/70' : 'text-red-700/70'}`}>
                      Removing this theme artifact is permanent. All local layout variations will be destroyed.
                  </p>
                  <button 
                      onClick={openDeleteConfirm}
                      className="w-full py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white text-[10px] font-semibold uppercase tracking-wide rounded-2xl transition-all shadow-xl shadow-black/10 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white"
                  >
                      Destroy Theme
                  </button>
              </Card>
            ) || (
              <div className={`p-8 rounded-[2rem] border-2 border-dashed ${adminTheme === 'dark' ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-slate-100 bg-slate-50/50'}`}>
                  <div className="flex flex-col items-center gap-3">
                     <FrameworkIcons.Lock size={20} className="text-indigo-500" />
                     <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 text-center opacity-70">
                        Protected: Active core theme
                     </p>
                  </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isRunSeedsConfirmOpen}
        onClose={() => setIsRunSeedsConfirmOpen(false)}
        onConfirm={handleRunSeeds}
        title="Run Theme Seeds?"
        description={`This will replay seed content for "${themeDetail?.name || 'this theme'}" and may overwrite existing records.`}
        confirmLabel="Run Seeds"
        cancelLabel="Cancel"
        variant="primary"
        isLoading={isReseeding}
      />

      <ConfirmDialog
        isOpen={isResetThemeConfirmOpen}
        onClose={() => setIsResetThemeConfirmOpen(false)}
        onConfirm={handleResetTheme}
        title="Reset Theme + Re-seed?"
        description={`This resets "${themeDetail?.name || 'this theme'}" config to defaults and then runs seeds again.`}
        confirmLabel="Reset & Run Seeds"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isResettingTheme}
      />

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Delete Theme?"
        description={`Are you sure you want to delete "${themeDetail?.name || 'this theme'}"? This action cannot be undone.`}
        confirmLabel="Delete Theme"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
