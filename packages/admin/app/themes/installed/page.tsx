"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePlugins } from '@fromcode119/react';
import { useTheme } from '@/components/theme-context';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNotify } from '@/components/notification-context';
import { FrameworkIcons } from '@/lib/icons';
import { UploadPreviewDialog, UploadPreviewSection } from '@/components/ui/upload-preview-dialog';

interface ThemeManifest {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  state?: 'active' | 'inactive';
  downloadUrl?: string;
  variables?: Record<string, string>;
  layouts?: any[];
  slots?: string[];
  iconUrl?: string;
}

export default function InstalledThemesPage() {
  const { theme } = useTheme();
  const { notify } = useNotify();
  const { triggerRefresh } = usePlugins();
  const [themes, setThemes] = useState<ThemeManifest[]>([]);
  const [marketplaceThemes, setMarketplaceThemes] = useState<ThemeManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isInspectingUpload, setIsInspectingUpload] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [showUploadPreview, setShowUploadPreview] = useState(false);
  const [uploadPreviewTitle, setUploadPreviewTitle] = useState('');
  const [uploadPreviewDescription, setUploadPreviewDescription] = useState('');
  const [uploadPreviewSections, setUploadPreviewSections] = useState<UploadPreviewSection[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function fetchThemes() {
    setLoading(true);
    try {
      const [installedData, marketplaceData] = await Promise.all([
        api.get(ENDPOINTS.THEMES.LIST),
        api.get(ENDPOINTS.THEMES.MARKETPLACE)
      ]);
      
      const installed = Array.isArray(installedData) ? installedData : (installedData.themes || []);
      const marketplace = Array.isArray(marketplaceData) ? marketplaceData : (marketplaceData.themes || []);
      
      setThemes(installed);
      setMarketplaceThemes(marketplace);
    } catch (err) {
      console.error("Failed to fetch themes", err);
      notify('error', 'Fetch Failed', 'Could not load themes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchThemes();
  }, []);

  const handleUploadClick = () => {
    if (isUploading || isInspectingUpload) return;
    fileInputRef.current?.click();
  };

  const uploadThemeFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      notify('error', 'Upload Failed', 'Only .zip theme packages are supported.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('theme', file);

    try {
      await api.upload(ENDPOINTS.THEMES.UPLOAD, formData);
      notify('success', 'Upload Successful', 'Theme uploaded successfully.');
      await fetchThemes();
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Upload Failed', err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const inspectThemeFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      notify('error', 'Upload Failed', 'Only .zip theme packages are supported.');
      return;
    }

    setIsInspectingUpload(true);
    const formData = new FormData();
    formData.append('theme', file);

    try {
      const response = await api.upload(ENDPOINTS.THEMES.UPLOAD_INSPECT, formData);
      const info = (response as any)?.info || {};
      const dependencies = Array.isArray(info.dependencies) ? info.dependencies : [];
      const bundled = Array.isArray(info.bundledPlugins) ? info.bundledPlugins : [];
      const existing = info.existing || { installed: false };

      const summaryItems = [
        `Name: ${info.name || 'Unknown'}`,
        `Slug: ${info.slug || 'Unknown'}`,
        `Version: ${info.version || 'Unknown'}`,
        `Files: ${info.files ?? 'Unknown'}`,
      ];

      const bundledItems = bundled.length
        ? bundled.map((plugin: any) => {
            if (plugin?.pluginSlug) {
              const version = plugin?.pluginVersion ? ` v${plugin.pluginVersion}` : '';
              const name = plugin?.pluginName ? `${plugin.pluginName} (${plugin.pluginSlug})` : plugin.pluginSlug;
              return `${name}${version} from ${plugin.archive}`;
            }
            return plugin?.archive || 'Unknown bundled plugin archive';
          })
        : ['No bundled plugin archives detected'];

      const impactItems = existing.installed
        ? [
            `This will replace installed theme "${info.slug}".`,
            `Current version: ${existing.version || 'Unknown'} (${existing.state || 'unknown'})`,
            `Incoming version: ${info.version || 'Unknown'}`,
          ]
        : ['This theme is not currently installed.'];

      setUploadPreviewTitle(`Install theme "${info.name || info.slug || 'package'}"?`);
      setUploadPreviewDescription('Review theme contents before continuing.');
      setUploadPreviewSections([
        { title: 'Summary', items: summaryItems },
        { title: 'Bundled Plugins', items: bundledItems },
        { title: 'Required Marketplace Plugins', items: dependencies.length ? dependencies : ['No required marketplace plugins'] },
        { title: 'Install Impact', items: impactItems },
      ]);
      setPendingUploadFile(file);
      setShowUploadPreview(true);
    } catch (err: any) {
      notify('error', 'Inspect Failed', err.message || 'Could not inspect theme package.');
    } finally {
      setIsInspectingUpload(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    await inspectThemeFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropActive(false);
    await inspectThemeFile(event.dataTransfer.files?.[0]);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropActive(false);
  };

  const closeUploadPreview = () => {
    if (isUploading) return;
    setShowUploadPreview(false);
    setPendingUploadFile(null);
  };

  const confirmUploadPreview = async () => {
    if (!pendingUploadFile) return;
    await uploadThemeFile(pendingUploadFile);
    setShowUploadPreview(false);
    setPendingUploadFile(null);
  };

  const handleActivate = async (slug: string) => {
    try {
      await api.post(ENDPOINTS.THEMES.ACTIVATE(slug));
      notify('success', 'Theme Activated', `${slug} is now the active theme.`);
      setThemes(prev => prev.map(t => ({
        ...t,
        state: t.slug === slug ? 'active' : 'inactive'
      })));
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Activation Failed', err.message);
    }
  };

  const handleUpdate = async (slug: string) => {
    try {
      notify('info', 'Updating...', `Downloading latest version of ${slug}...`);
      await api.post(ENDPOINTS.THEMES.INSTALL(slug));
      notify('success', 'Updated', `Theme ${slug} has been updated.`);
      fetchThemes();
      triggerRefresh();
    } catch (err: any) {
      notify('error', 'Update Failed', err.message);
    }
  };

  const handleDelete = async (slug: string, isActive: boolean) => {
    const confirmationMessage = isActive
      ? `Theme "${slug}" is active. The system will switch to another theme if available, or continue with no active theme. Continue?`
      : `Are you sure you want to delete theme "${slug}"? This cannot be undone.`;
    if (!confirm(confirmationMessage)) return;
    try {
      await api.delete(ENDPOINTS.THEMES.DELETE(slug));
      notify('success', 'Theme Deleted', `${slug} has been removed.`);
      fetchThemes();
    } catch (err: any) {
      notify('error', 'Deletion Failed', err.message);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 min-[1400px]:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-64 rounded-3xl animate-pulse ${theme === 'dark' ? 'bg-slate-900/40' : 'bg-white border-2 border-slate-50 shadow-xl shadow-slate-200/50'}`} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div
        onClick={handleUploadClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-5 transition-all ${
          isDropActive
            ? (theme === 'dark' ? 'border-indigo-400 bg-indigo-500/10' : 'border-indigo-500 bg-indigo-50')
            : (theme === 'dark' ? 'border-slate-700 bg-slate-900/30 hover:border-slate-500' : 'border-slate-200 bg-white hover:border-slate-300')
        }`}
      >
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip" />
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FrameworkIcons.Upload size={18} className={isDropActive ? 'text-indigo-500' : 'text-slate-400'} />
            <p className={`text-sm font-medium ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>
              Drag and drop theme `.zip` here, or click to upload.
            </p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleUploadClick();
            }}
            disabled={isUploading || isInspectingUpload}
            className="flex items-center justify-center gap-3 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold uppercase tracking-wider text-[11px] transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_15px_30px_-5px_rgba(79,70,229,0.3)] disabled:opacity-50"
          >
            {isUploading || isInspectingUpload ? <FrameworkIcons.Loader className="animate-spin" size={16} /> : <FrameworkIcons.Plus size={16} strokeWidth={2.5} />}
            <span>{isInspectingUpload ? 'Inspecting...' : 'Upload Theme (.zip)'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 min-[1400px]:grid-cols-3 gap-6">
        {themes.length === 0 ? (
          <div className="col-span-full py-20 text-center rounded-[3rem] border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <FrameworkIcons.Palette size={32} className="text-slate-300 dark:text-slate-700" />
            </div>
            <h3 className={`text-xl font-semibold mb-1 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>No themes installed</h3>
            <p className="text-slate-500 font-medium italic">Your creative workspace is currently empty.</p>
          </div>
        ) : themes.map(t => {
          const isActive = t.state === 'active';
          const marketplaceMatch = marketplaceThemes.find(r => r.slug === t.slug);
          const hasUpdate = marketplaceMatch && marketplaceMatch.version !== t.version;

          return (
            <Card 
              key={t.slug}
              className={`group flex flex-col border-0 relative transition-all duration-500 overflow-hidden rounded-[2.5rem] ${
                isActive 
                  ? (theme === 'dark' ? 'bg-indigo-500/5 ring-2 ring-indigo-500/50 shadow-2xl shadow-indigo-500/10' : 'bg-white ring-2 ring-indigo-500/10 shadow-2xl shadow-indigo-500/5')
                  : (theme === 'dark' ? 'bg-slate-900/40 hover:bg-slate-900/60 ring-1 ring-white/5' : 'bg-white shadow-xl shadow-slate-200/50 hover:shadow-indigo-500/10')
              }`}
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg transform transition-transform group-hover:rotate-6 ${
                    isActive 
                      ? 'bg-indigo-600 text-white' 
                      : (theme === 'dark' ? 'bg-slate-800 text-indigo-400' : 'bg-indigo-50 text-indigo-600')
                  }`}>
                    {t.iconUrl ? <img src={t.iconUrl} className="w-8 h-8 rounded-lg" alt="" /> : <FrameworkIcons.Palette size={28} />}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasUpdate && (
                      <Badge variant="warning" className="animate-pulse">Update</Badge>
                    )}
                    <Badge variant={isActive ? 'blue' : 'gray'} className="font-semibold uppercase tracking-wider text-[9px]">
                      {isActive ? 'Active Core' : 'Installed'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Link 
                      href={`/themes/${t.slug}`}
                      className={`group/title flex items-center gap-2 text-2xl font-semibold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'} hover:text-indigo-600 transition-colors`}
                    >
                      {t.name}
                      <FrameworkIcons.Right size={18} className="opacity-0 -translate-x-2 group-hover/title:opacity-100 group-hover/title:translate-x-0 transition-all text-indigo-500" />
                    </Link>
                    <span className="text-[10px] font-bold text-slate-400">v{t.version}</span>
                  </div>
                  <p className={`text-sm leading-relaxed font-medium line-clamp-2 italic ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t.description || "A clean and modern theme for your Fromcode frontend."}
                  </p>
                  {t.author && (
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-4 bg-indigo-500 rounded-full" />
                      <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider">Architect: {t.author}</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-auto">
                  {hasUpdate && (
                    <button 
                      onClick={() => handleUpdate(t.slug)}
                      className="w-full mb-3 py-4 rounded-2xl font-semibold uppercase tracking-wider text-[11px] bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                    >
                      <FrameworkIcons.Clock size={16} />
                      Upgrade to v{marketplaceMatch.version}
                    </button>
                  )}
                  {isActive ? (
                    <div className="flex gap-3">
                      <Link 
                        href={`/themes/${t.slug}`}
                        className="flex-1 py-4 rounded-2xl font-semibold uppercase tracking-wider text-[11px] bg-indigo-600 text-white text-center shadow-xl shadow-indigo-600/20 hover:scale-[1.02] transition-transform"
                      >
                        Manage Layout
                      </Link>
                      <Link 
                        href={`/themes/${t.slug}?tab=settings`}
                        className={`p-4 rounded-2xl flex items-center justify-center transition-all ${
                          theme === 'dark' ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                        } shadow-sm`}
                      >
                        <FrameworkIcons.Settings size={18} />
                      </Link>
                      <button 
                        onClick={() => handleDelete(t.slug, true)}
                        className={`p-4 rounded-2xl transition-all ${theme === 'dark' ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white shadow-sm'}`}
                        title="Delete theme"
                      >
                        <FrameworkIcons.Trash size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleActivate(t.slug)}
                        className="flex-1 py-4 rounded-2xl font-semibold uppercase tracking-wider text-[11px] bg-slate-900 dark:bg-white dark:text-slate-900 text-white transition-all transform hover:scale-[1.02] shadow-xl shadow-slate-900/20"
                      >
                        Activate System
                      </button>
                      <button 
                        onClick={() => handleDelete(t.slug, false)}
                        className={`p-4 rounded-2xl transition-all ${theme === 'dark' ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-rose-50 text-rose-500 hover:bg-rose-600 hover:text-white shadow-sm'}`}
                      >
                        <FrameworkIcons.Trash size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <UploadPreviewDialog
        isOpen={showUploadPreview}
        title={uploadPreviewTitle}
        description={uploadPreviewDescription}
        sections={uploadPreviewSections}
        confirmLabel="Install Theme"
        cancelLabel="Cancel"
        isLoading={isUploading}
        onClose={closeUploadPreview}
        onConfirm={confirmUploadPreview}
      />
    </div>
  );
}
