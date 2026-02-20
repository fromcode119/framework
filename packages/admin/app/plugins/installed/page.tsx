"use client";

import React, { useEffect, useState } from 'react';
import { usePlugins, Plugin } from '@fromcode/react';
import { useTheme } from '@/components/theme-context';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { DependencyDialog, DependencyIssue } from '@/components/ui/dependency-dialog';
import { useNotify } from '@/components/notification-context';
import { FrameworkIcons } from '@/lib/icons';
import Link from 'next/link';
import { Loader } from '@/components/ui/loader';

export default function InstalledPluginsPage() {
  const { theme } = useTheme();
  const { notify } = useNotify();
  const { triggerRefresh, refreshVersion } = usePlugins();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [marketplaceData, setMarketplaceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDependencyConfirm, setShowDependencyConfirm] = useState(false);
  const [dependencyIssues, setDependencyIssues] = useState<DependencyIssue[]>([]);
  const [targetPlugin, setTargetPlugin] = useState<string | null>(null);
  const [pluginToDelete, setPluginToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function fetchPlugins() {
    try {
      const [data, reg] = await Promise.all([
        api.get(`${ENDPOINTS.PLUGINS.LIST}?refresh=1`),
        api.get(ENDPOINTS.PLUGINS.MARKETPLACE)
      ]);
      setPlugins(Array.isArray(data) ? data : []);
      setMarketplaceData(reg.plugins || []);
    } catch (err) {
      console.error("Failed to fetch plugins", err);
    } finally {
      setLoading(false);
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('plugin', file);

    try {
      const response = await fetch(api.getURL(ENDPOINTS.PLUGINS.UPLOAD), {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) throw new Error('Upload failed');

      notify('success', 'Upload Successful', 'Plugin uploaded successfully.');
      fetchPlugins();
    } catch (err: any) {
      notify('error', 'Upload Failed', err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, [refreshVersion]);

  const handleToggle = async (slug: string, currentEnabled: boolean, options: { force?: boolean, recursive?: boolean } = {}) => {
    try {
      if (!currentEnabled) setIsActivating(true);
      
      await api.post(ENDPOINTS.PLUGINS.TOGGLE(slug), { 
        enabled: !currentEnabled,
        ...options 
      });
      
      notify('success', 'Plugin Updated', `${slug} is now ${!currentEnabled ? 'active' : 'inactive'}.`);
      setPlugins(prev => prev.map(p => p.slug === slug ? { ...p, state: !currentEnabled ? 'active' : 'inactive' } : p));
      
      if (options.recursive || options.force) {
        setShowDependencyConfirm(false);
        fetchPlugins();
      }
      
      triggerRefresh();
    } catch (err: any) {
      if (err.status === 409 && err.data?.issues) {
        setDependencyIssues(err.data.issues);
        setTargetPlugin(slug);
        setShowDependencyConfirm(true);
      } else {
        notify('error', 'Update Failed', err.message);
      }
    } finally {
      setIsActivating(false);
    }
  };

  const handleDelete = async () => {
    if (!pluginToDelete) return;
    setIsDeleting(true);
    try {
      const plugin = plugins.find(p => p.slug === pluginToDelete);
      
      if (plugin && plugin.state === 'active') {
        await api.post(ENDPOINTS.PLUGINS.TOGGLE(pluginToDelete), { enabled: false });
      }

      await api.delete(ENDPOINTS.PLUGINS.DELETE(pluginToDelete));
      notify('success', 'Deleted', `Plugin ${pluginToDelete} removed.`);
      setPlugins(prev => prev.filter(p => p.slug !== pluginToDelete));
      setShowDeleteConfirm(false);
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Delete Failed', err.message);
    } finally {
      setIsDeleting(false);
      setPluginToDelete(null);
    }
  };

  const filteredPlugins = plugins.filter(p => 
    (p.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
    (p.slug?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-screen">
          <Loader label="Synchronizing Global Marketplace Catalog" />
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-6">
        <div className="relative flex-1 group">
          <FrameworkIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={16} />
          <input 
            type="text" 
            placeholder="Search installed plugins..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full rounded-2xl py-2.5 pl-11 pr-6 outline-none border-0 font-bold transition-all ${theme === 'dark' ? 'bg-slate-900/60 text-white placeholder:text-slate-600 focus:ring-2 ring-indigo-500/50 shadow-2xl shadow-indigo-500/5' : 'bg-white text-slate-900 placeholder:text-slate-400 focus:ring-2 ring-indigo-500/20 shadow-xl shadow-slate-200/50'}`} 
          />
        </div>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip,.tar.gz" />
        <button 
          onClick={handleUploadClick}
          disabled={isUploading}
          className={`flex items-center justify-center gap-3 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold uppercase tracking-wider text-[11px] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_15px_30px_-5px_rgba(79,70,229,0.3)] disabled:opacity-50`}
        >
          {isUploading ? <FrameworkIcons.Loader className="animate-spin" size={16} /> : <FrameworkIcons.Plus size={16} strokeWidth={2.5} />}
          <span>Upload (.zip)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredPlugins.length === 0 ? (
          <div className="col-span-full py-20 text-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
             <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                <FrameworkIcons.Plugins size={32} className="text-slate-300 dark:text-slate-700" />
             </div>
             <h3 className={`text-xl font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No plugins found</h3>
             <p className="text-slate-500 font-medium">Try a different search term or upload a new plugin.</p>
          </div>
        ) : (
          filteredPlugins.map(plugin => {
            const marketEntry = marketplaceData.find(r => r.slug === plugin.slug);
            const hasUpdate = marketEntry && marketEntry.version !== plugin.version;
            const hasImageError = imageErrors[plugin.slug];

            return (
              <Card 
                key={plugin.slug}
                className={`group flex flex-col md:flex-row border-0 relative transition-all duration-700 overflow-hidden rounded-3xl ${theme === 'dark' ? 'bg-slate-900/40 hover:bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-xl shadow-slate-200/50 hover:shadow-indigo-500/10'}`}
              >
                 <div className="p-6 flex flex-col md:flex-row flex-1 items-center gap-8 relative">
                    <div className={`h-20 w-20 rounded-2xl flex-shrink-0 flex items-center justify-center transition-all duration-700 group-hover:rotate-3 group-hover:scale-105 shadow-lg ${theme === 'dark' ? 'bg-slate-800 text-indigo-400 ring-1 ring-white/10' : 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 shadow-indigo-100'}`}>
                      {(plugin as any).iconUrl && !hasImageError ? (
                        <img 
                          src={(plugin as any).iconUrl} 
                          alt={plugin.name} 
                          className="w-10 h-10 object-contain" 
                          onError={() => setImageErrors(prev => ({ ...prev, [plugin.slug]: true }))}
                        />
                      ) : (
                        <FrameworkIcons.Box size={36} strokeWidth={1.5} />
                      )}
                    </div>
                    
                    <div className="flex-1 space-y-2 text-center md:text-left">
                       <div className="flex items-center justify-center md:justify-start gap-3">
                          <Badge variant={plugin.state === 'active' ? 'success' : 'gray'} className="flex-shrink-0">
                              {plugin.state === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                          
                          {plugin.healthStatus && plugin.healthStatus !== 'healthy' && (
                             <Badge variant={plugin.healthStatus === 'error' ? 'rose' : 'amber'} className="animate-pulse flex items-center gap-1.5">
                                <FrameworkIcons.Zap size={10} />
                                {plugin.healthStatus === 'error' ? 'Security Alert' : 'Heuristic Warning'}
                             </Badge>
                          )}

                          {hasUpdate && (
                             <Link 
                               href={`/plugins/marketplace/${plugin.slug}`}
                               className="flex items-center gap-2 px-2 py-0.5 bg-amber-500 text-white rounded-lg animate-pulse no-underline shadow-md shadow-amber-500/20"
                             >
                                <FrameworkIcons.Loader size={8} className="animate-spin" />
                                <span className="text-[8px] font-semibold uppercase tracking-wider leading-none">Update</span>
                             </Link>
                           )}
                       </div>
                       
                       <div className="space-y-1">
                          <Link href={`/plugins/${plugin.slug}`}>
                             <h3 className={`text-2xl font-semibold tracking-tighter transition-colors duration-300 group-hover:text-indigo-500 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                                {plugin.name}
                             </h3>
                          </Link>
                          <p className={`text-[13px] leading-snug font-medium line-clamp-1 transition-colors duration-300 ${theme === 'dark' ? 'text-slate-400 group-hover:text-slate-300' : 'text-slate-500 group-hover:text-slate-600'}`}>
                            {plugin.description || `Manage and configure your ${plugin.name} tools.`}
                          </p>
                       </div>

                       <div className={`flex items-center justify-center md:justify-start gap-4 text-[9px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500/80'}`}>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-sm transition-colors ${
                          theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-100 text-slate-600'
                        }`}>
                          <FrameworkIcons.Shield size={10} className="text-indigo-500" />
                          v{plugin.version}
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-sm transition-colors ${
                          theme === 'dark' ? 'bg-slate-800/50 border-white/5' : 'bg-white border-slate-100 text-slate-600'
                        }`}>
                          <FrameworkIcons.User size={10} className="text-indigo-500" />
                          <span className="truncate">
                            {typeof plugin.author === 'object' ? (plugin.author as any).name : (plugin.author || 'Official')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 w-full md:w-auto md:min-w-[220px]">
                      <div className={`flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 ${
                        theme === 'dark' 
                          ? 'bg-slate-800/40 border-white/10 hover:bg-slate-800/60' 
                          : 'bg-slate-100/50 border-slate-200/60 shadow-inner'
                      }`}>
                          <div className="flex flex-col">
                            <span className={`text-[8px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                              Activation
                            </span>
                          </div>
                          <Switch 
                            checked={plugin.state === 'active'} 
                            onChange={() => handleToggle(plugin.slug, plugin.state === 'active')}
                            className="scale-75 origin-right"
                          />
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2">
                        <Link 
                          href={`/plugins/${plugin.slug}`} 
                          className={`col-span-4 sm:col-span-2 flex items-center justify-center gap-2 h-9 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all shadow-md active:scale-[0.97] ${
                            theme === 'dark' ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                          }`}
                        >
                          <FrameworkIcons.Right size={14} />
                          <span>Open</span>
                        </Link>
                        
                        <Link 
                          href={`/plugins/${plugin.slug}?tab=settings`} 
                          className={`col-span-2 sm:col-span-1 h-9 rounded-lg flex items-center justify-center transition-all border ${
                            theme === 'dark' 
                              ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-indigo-400 hover:bg-slate-700' 
                              : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 shadow-sm hover:shadow-md'
                          }`}
                        >
                          <FrameworkIcons.Settings size={14} />
                        </Link>

                        {plugin.healthStatus && plugin.healthStatus !== 'healthy' && (
                          <button 
                            onClick={() => handleToggle(plugin.slug, true)}
                            className={`col-span-2 sm:col-span-1 h-9 rounded-lg flex items-center justify-center transition-all border group/kill ${
                              theme === 'dark' 
                                ? 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white' 
                                : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white shadow-sm'
                            }`}
                            title="Emergency Deactivate"
                          >
                             <FrameworkIcons.Zap size={14} className="group-hover/kill:animate-ping" />
                          </button>
                        )}

                        <button 
                          onClick={() => { setPluginToDelete(plugin.slug); setShowDeleteConfirm(true); }}
                          className={`col-span-2 sm:col-span-1 h-9 rounded-lg flex items-center justify-center transition-all border ${
                            theme === 'dark' 
                              ? 'bg-slate-800 border-slate-700 text-slate-500 hover:text-red-400' 
                              : 'bg-white border-slate-200 text-slate-400 hover:text-red-500 shadow-sm hover:shadow-md'
                          }`}
                        >
                          <FrameworkIcons.Trash size={14} />
                        </button>
                      </div>
                    </div>
                 </div>
              </Card>
            );
          })
        )}
      </div>
      </>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setPluginToDelete(null);
        }}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Destroy Plugin"
        description={`This will permanently remove ${pluginToDelete} and all its data. ${
          plugins.find(p => p.slug === pluginToDelete)?.state === 'active' 
            ? "Since it's currently active, we'll deactivate it first." 
            : ""
        }`}
        confirmLabel="Destroy Now"
      />

      <DependencyDialog
        isOpen={showDependencyConfirm}
        onClose={() => {
          setShowDependencyConfirm(false);
          setTargetPlugin(null);
        }}
        onConfirm={async (recursive, force) => {
          if (!targetPlugin) return;
          
          if (recursive) {
            const missing = dependencyIssues.filter(i => i.type === 'missing');
            if (missing.length > 0) {
              for (const issue of missing) {
                notify('info', 'Dependency Install', `Downloading ${issue.slug} from marketplace...`);
                try {
                  await api.post(ENDPOINTS.PLUGINS.INSTALL(issue.slug), {});
                } catch (e: any) {
                  notify('error', 'Auto-Install Failed', `Could not install ${issue.slug}: ${e.message}`);
                  return;
                }
              }
            }
          }

          handleToggle(targetPlugin, false, { recursive, force });
        }}
        issues={dependencyIssues}
        pluginSlug={targetPlugin || ''}
        isLoading={isActivating}
      />
    </div>
  );
}
