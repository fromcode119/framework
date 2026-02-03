"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Slot, usePlugins } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TagField } from '@/components/ui/TagField';
import { Button } from '@/components/ui/Button';
import { PermalinkInput } from '@/components/ui/PermalinkInput';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ArrayField } from '@/components/ui/ArrayField';
import { FrameworkIcons } from '@/lib/icons';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

const TagFieldLocal = ({ field, value, onChange, theme, collectionSlug }: { field: any, value: any, onChange: (val: any) => void, theme: string, collectionSlug: string }) => {
  const sourceCollection = field.admin?.sourceCollection || field.relationTo;
  return (
    <TagField 
      collectionSlug={collectionSlug}
      fieldName={field.name}
      value={value}
      onChange={onChange}
      theme={theme}
      sourceCollection={sourceCollection}
      sourceField={field.admin?.sourceField || (sourceCollection === 'users' ? 'username' : 'slug')}
      hasMany={field.hasMany !== undefined ? field.hasMany : (field.admin?.component === 'TagField' || field.admin?.component === 'Tags')}
      allowCreate={sourceCollection !== 'users'}
    />
  );
};

export default function CollectionEditPage() {
  const { pluginSlug, slug, id } = useParams() as { pluginSlug: string, slug: string, id: string };
  const router = useRouter();
  const plugins = usePlugins();
  const { collections, settings } = plugins;
  const fieldComponents = (plugins as any).fieldComponents || {};
  console.log('[Admin] Field components available:', Object.keys(fieldComponents));
  const { theme } = useTheme();

  const frontendUrl = (settings?.frontend_url || '').replace(/\/$/, '');
  
  const isNew = id === 'new';
  const collection = collections.find(c => {
    // Check if the actual collection slug (prefixed) matches the URL slug (short)
    const isSlugMatch = c.shortSlug === slug || c.slug === slug || c.unprefixedSlug === slug;
    const isPluginMatch = c.pluginSlug === pluginSlug || (c.pluginSlug === 'cms' && pluginSlug === 'cms');
    
    return isSlugMatch && isPluginMatch;
  });
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugWarning, setSlugWarning] = useState<string | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<any | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [hasMoreRevisions, setHasMoreRevisions] = useState(false);
  const [revisionPage, setRevisionPage] = useState(1);

  // Keyboard shortcut for saving
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit(new Event('submit') as any);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData, saving]);

  const currentRevIndex = selectedRevision ? revisions.findIndex(r => r.id === selectedRevision.id) : -1;

  const resolvedSlug = collection?.slug || slug;

  async function fetchRevisions(page: number) {
    setRevisionsLoading(true);
    try {
      const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/versions?ref_id=${id}&ref_collection=${resolvedSlug}&sort=-id&limit=10&page=${page}`);
      
      const mapped = (result.docs || []).map((v: any) => ({
        id: v.id,
        version: v.version || 1,
        date: new Date(v.created_at || v.createdAt),
        user: v.updated_by || v.updatedBy || 'System',
        action: v.change_summary || 'Update',
        changes: v.version_data
      }));

      if (page === 1) {
        setRevisions(mapped);
      } else {
        setRevisions(prev => [...prev, ...mapped]);
      }
      
      setHasMoreRevisions(result.hasNextPage || (result.docs?.length === 10));
    } catch (err) {
      console.error("Failed to fetch revisions:", err);
    } finally {
      setRevisionsLoading(false);
    }
  }

  const loadMoreRevisions = () => {
    const nextPage = revisionPage + 1;
    setRevisionPage(nextPage);
    fetchRevisions(nextPage);
  };

  const getPreviewUrl = () => {
    if (!formData) return '#';
    
    // PRIORITY: If we have an explicit custom permalink override, use it directly
    if (formData.customPermalink) {
      return `${frontendUrl}/${formData.customPermalink.startsWith('/') ? formData.customPermalink.substring(1) : formData.customPermalink}?preview=1&draft=1`;
    }

    // FALLBACK: Use the global structure logic
    const pathValue = formData.slug || id;
    const structure = settings?.permalink_structure || '/:slug';
    
    const now = new Date();
    const replacements: Record<string, string> = {
      ':year': now.getFullYear().toString(),
      ':month': (now.getMonth() + 1).toString().padStart(2, '0'),
      ':day': now.getDate().toString().padStart(2, '0'),
      ':id': id,
      ':slug': pathValue,
    };

    let path = structure;
    Object.entries(replacements).forEach(([key, val]) => {
      path = path.replace(key, val);
    });

    // Clean up double slashes and ensure leading slash
    path = path.replace(/\/+/g, '/');
    if (!path.startsWith('/')) path = '/' + path;

    return `${frontendUrl}${path}?preview=1&draft=1`;
  };

  const slugify = (text: string) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')     // Replace spaces with -
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-');  // Replace multiple - with single -
  };

  useEffect(() => {
    if (isNew || !collection) return;

    async function fetchData() {
      try {
        const entryData = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${id}`);

        setFormData(entryData);
        if (entryData.slug) setSlugManuallyEdited(true);

        // Fetch revisions with pagination
        fetchRevisions(1);

      } catch (err) {
        console.error("Failed to fetch entry:", err);
        setStatus({ type: 'error', message: 'Failed to load entry' });
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [resolvedSlug, id, isNew, collection]);

  // Debounced slug uniqueness check
  useEffect(() => {
    if (!formData.slug || !collection) {
      setSlugWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        // Query the collection for existing slug using direct matching
        const query = `?slug=${encodeURIComponent(formData.slug)}&limit=1`;
        const response = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}${query}`);
        
        // Handle result Doc structure
        const results = response.docs || [];
        
        if (Array.isArray(results) && results.length > 0) {
          const match = results[0];
          // If it's a different record, it's a duplicate
          if (isNew || String(match.id) !== String(id)) {
            setSlugWarning(`This slug is already taken by "${match.name || match.title || match.id}".`);
          } else {
            setSlugWarning(null);
          }
        } else {
          setSlugWarning(null);
        }
      } catch (err) {
        // Silent fail for validation helper
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.slug, resolvedSlug, id, isNew, collection]);

  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in zoom-in-95 duration-700">
        <div className={`p-8 rounded-[40px] mb-8 relative group ${theme === 'dark' ? 'bg-slate-900 shadow-2xl shadow-black/50' : 'bg-white shadow-2xl shadow-slate-200'}`}>
           <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
           <FrameworkIcons.Search size={64} className="text-indigo-500 relative z-10" strokeWidth={1} />
        </div>
        
        <h2 className={`text-4xl font-black tracking-tighter uppercase mb-4 ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          Collection Not Found
        </h2>
        
        <p className="text-slate-500 font-bold text-center max-w-sm leading-relaxed mb-10 px-6">
          The collection <span className="text-indigo-500">"{slug}"</span> doesn't seem to be part of the <span className="text-indigo-500 uppercase tracking-widest text-xs ml-1">{pluginSlug}</span> plugin registry.
        </p>

        <div className="flex items-center gap-4">
          <Button 
            variant="ghost"
            onClick={() => window.history.back()}
            className="rounded-2xl px-8 font-black uppercase tracking-widest text-xs text-slate-400"
          >
            Go Back
          </Button>
          <Button 
            variant="primary"
            as={Link}
            href="/"
            className="rounded-2xl px-10 py-5 font-black uppercase tracking-widest text-xs shadow-2xl shadow-indigo-500/30"
            icon={<FrameworkIcons.Layout size={18} />}
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const handleInputChange = (name: string, value: any) => {
    // If the value actually changed, clear active version highlight
    if (formData[name] !== value) {
      setActiveVersionId(null);
    }

    setFormData(prev => {
      const newData = { ...prev, [name]: value };

      // Auto-generate slug and permalink logic
      const sourceField = collection.admin?.useAsTitle || (collection.fields.find(f => f.name === 'name' || f.name === 'title')?.name);
      
      if (name === sourceField && !slugManuallyEdited && isNew) {
        const newSlug = slugify(value);
        newData.slug = newSlug;
        if (!newData.customPermalink) {
          newData.customPermalink = newSlug;
        }
      }

      if (name === 'slug') {
        setSlugManuallyEdited(true);
        // Sync permalink with slug if it hasn't been manually diversified
        if (!prev.customPermalink || prev.customPermalink === prev.slug) {
           newData.customPermalink = value;
        }
      }

      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const url = isNew 
        ? `${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}` 
        : `${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${id}`;

      const result = await (isNew ? api.post(url, formData) : api.put(url, formData));

      setStatus({ type: 'success', message: `Entry ${isNew ? 'created' : 'updated'} successfully` });
      
      // Refresh revisions
      if (!isNew) {
        fetchRevisions(1);
      }

      if (isNew) {
        router.push(`/${pluginSlug}/${slug}/${result.id}`);
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Operation failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${id}`);
      router.push(`/${pluginSlug}/${slug}`);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const hasSlug = collection.fields.some(f => f.name === 'slug');
  const showPreview = collection.admin?.preview !== false && !isNew;
  const showPermalink = collection.admin?.preview !== false && hasSlug;

  return (
    <div className="w-full min-h-screen flex flex-col animate-in fade-in duration-500">
      <div className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
          : 'bg-white/80 border-slate-100 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
          <div className="flex items-center gap-2 mb-4">
            <Link 
              href={`/${pluginSlug}/${slug}`}
              className={`flex items-center gap-1.5 text-xs font-black uppercase tracking-widest transition-all hover:-translate-x-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}
            >
              <FrameworkIcons.Left size={14} />
              {collection.name || slug}
            </Link>
            <span className="text-slate-300">/</span>
            <span className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
              {isNew ? 'New Entry' : (id.length > 8 ? `${id.substring(0, 8)}...` : id)}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className={`text-2xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {isNew ? `Create ${collection.name || collection.slug}` : `Edit ${collection.admin?.useAsTitle && formData[collection.admin.useAsTitle] ? formData[collection.admin.useAsTitle] : (formData.title || formData.name || collection.name || 'Entry')}`}
              </h1>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70 mt-1">
                {isNew ? `Define a new record for ${collection.name || collection.slug}` : `Modify existing ${formData.title || formData.name || collection.name || 'entry'}`}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {formData?.scheduledPublishAt && (formData.status === 'draft' || !formData.status) && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black uppercase tracking-widest text-[12px] animate-pulse">
                  <FrameworkIcons.Clock size={14} />
                  Scheduled: {new Date(formData.scheduledPublishAt).toLocaleDateString()}
                </div>
              )}
              {showPreview && (
                <a 
                  href={getPreviewUrl()}
                  target="_blank"
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${
                    theme === 'dark' 
                      ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700' 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-100'
                  }`}
                >
                  <FrameworkIcons.Eye size={14} />
                  Preview
                </a>
              )}
<<<< (Rest of buttons)
              {!isNew && (
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className={`p-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm ${theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20' : ''}`}
                >
                  <FrameworkIcons.Trash size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-8 py-12">
        <div className="max-w-7xl mx-auto">
          {status && (
            <div className={`mb-8 p-4 rounded-2xl flex items-start gap-4 border animate-in slide-in-from-top-2 ${status.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
              <div className={`p-2 rounded-xl ${status.type === 'success' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'}`}>
                {status.type === 'success' ? <FrameworkIcons.Check size={20} /> : <FrameworkIcons.Alert size={20} />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm">{status.type === 'success' ? 'Success' : 'Error'}</p>
                <p className="text-sm opacity-90">{status.message}</p>
              </div>
              <button onClick={() => setStatus(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <FrameworkIcons.Close size={18} />
              </button>
            </div>
          )}

          <Slot name={`admin.collection.${slug}.edit.top`} props={{ formData, setFormData, isNew }} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-32">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                  {collection.fields
                    .filter(f => !f.admin?.hidden && f.admin?.position !== 'sidebar')
                    .map((field) => (
                    <div key={field.name} className={`${field.type === 'textarea' || field.type === 'richText' || field.admin?.component === 'TagField' || field.admin?.component === 'Tags' || field.type === 'json' ? 'md:col-span-2' : ''}`}>
                      <label className={`block text-xs font-black uppercase tracking-widest mb-3 pl-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}
                        {field.required && <span className="text-rose-500 ml-1 font-bold font-sans">*</span>}
                      </label>
                      
                        {field.type === 'relationship' || field.admin?.component === 'TagField' || field.admin?.component === 'Tags' ? (
                          <TagFieldLocal 
                            field={field} 
                            value={formData[field.name]} 
                            onChange={(val) => handleInputChange(field.name, val)}
                            theme={theme}
                            collectionSlug={resolvedSlug}
                          />
                        ) : field.admin?.component ? (() => {
                          const componentName = field.admin.component;
                          const CustomComponent = fieldComponents[componentName];
                          
                          if (CustomComponent) {
                            return (
                              <CustomComponent 
                                value={formData[field.name]}
                                onChange={(val: any) => handleInputChange(field.name, val)}
                                theme={theme}
                                field={field}
                              />
                            );
                          }

                          return (
                            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                               <FrameworkIcons.Alert size={12} />
                               Component "{componentName}" not registered by any plugin.
                            </div>
                          );
                        })() : (field.type === 'textarea' || field.type === 'richText') ? (
                          {/* ... existing textarea ... */}
                        ) : field.type === 'json' ? (
                          {/* ... existing json ... */}
                        ) : field.type === 'array' ? (
                          {/* ... existing array ... */}
                        ) : field.type === 'password' || (field.name === 'password' && isNew) ? (
                          {/* ... existing password ... */}
                        ) : field.type === 'select' ? (
                          {/* ... existing select ... */}
                        ) : (
                        <div className="relative">
                          <Input 
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={formData[field.name] || ''}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            placeholder={`Enter ${field.label || field.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}...`}
                            disabled={saving}
                            className={`font-bold ${field.name === 'slug' && slugWarning ? 'border-amber-400 focus:ring-amber-400/20' : ''}`}
                          />
                          {field.name === 'slug' && slugWarning && (
                            <div className="absolute top-full left-0 mt-2 flex items-center gap-2 text-xs font-bold text-amber-500 animate-in fade-in slide-in-from-top-1 px-1">
                               <FrameworkIcons.Alert size={12} />
                               <span>{slugWarning}</span>
                            </div>
                          )}
                          {field.name === 'slug' && !slugManuallyEdited && isNew && formData[field.name] && (
                             <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-lg text-[10px] font-black uppercase tracking-widest animate-pulse border border-indigo-500/20 pointer-events-none">
                                <FrameworkIcons.Refresh size={8} />
                                Auto
                             </div>
                          )}
                        </div>
                      )}
                      {field.admin?.description && (
                        <p className="mt-2.5 text-xs text-slate-400 font-bold uppercase tracking-tight opacity-60 ml-1">{field.admin.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Slot name={`admin.collection.${slug}.edit.sidebar`} props={{ formData, setFormData, isNew }} />
              <Slot name="admin.collection.edit.sidebar" props={{ formData, setFormData, isNew }} />
              
              {showPermalink && (
                <Card title="Preview & Permalink">
                   <PermalinkInput
                      value={formData.customPermalink}
                      onChange={(val) => handleInputChange('customPermalink', val)}
                      disabled={saving}
                      id={isNew ? undefined : id}
                      slug={formData.slug}
                    />
                    <p className="mt-2 text-[12px] text-slate-400 font-bold uppercase tracking-tight opacity-50">
                      Click the path component to override the automatically generated slug.
                    </p>
                </Card>
              )}

              {collection.fields.some(f => f.admin?.position === 'sidebar' && !f.admin?.hidden) && (
                <Card title="Settings">
                  <div className="space-y-6">
                    {collection.fields
                      .filter(f => f.admin?.position === 'sidebar' && !f.admin?.hidden && f.name !== 'customPermalink')
                      .map((field) => (
                        <div key={field.name}>
                          <label className={`block text-xs font-black uppercase tracking-widest mb-2 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                            {field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}
                          </label>
                          {field.type === 'select' ? (
                            <Select
                              value={formData[field.name] || field.defaultValue || ''}
                              options={field.options || []}
                              onChange={(val) => handleInputChange(field.name, val)}
                              disabled={saving}
                              theme={theme}
                            />
                          ) : (field.type === 'relationship' || field.admin?.component === 'TagField' || field.admin?.component === 'Tags') ? (
                            <TagFieldLocal 
                              field={field} 
                              value={formData[field.name]} 
                              onChange={(val) => handleInputChange(field.name, val)}
                              theme={theme}
                              collectionSlug={resolvedSlug}
                            />
                          ) : field.type === 'array' ? (
                            <ArrayField 
                              field={field}
                              value={formData[field.name]}
                              onChange={(val) => handleInputChange(field.name, val)}
                              theme={theme}
                              collectionSlug={resolvedSlug}
                            />
                          ) : field.type === 'boolean' ? (
                            <div className="flex items-center gap-2">
                               {/* Add boolean toggle here if needed, or use Select for now */}
                               <Select
                                value={formData[field.name]?.toString() || field.defaultValue?.toString() || 'false'}
                                options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]}
                                onChange={(val) => handleInputChange(field.name, val === 'true')}
                                disabled={saving}
                                theme={theme}
                              />
                            </div>
                          ) : (
                            <Input 
                              value={formData[field.name] || ''}
                              onChange={(e) => handleInputChange(field.name, e.target.value)}
                              placeholder={`Enter ${field.label || field.name}...`}
                              disabled={saving}
                              className="text-xs h-10 font-bold"
                            />
                          )}
                          {field.admin?.description && (
                            <p className="mt-1.5 text-xs text-slate-400 font-bold uppercase tracking-tight opacity-50">{field.admin.description}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </Card>
              )}

              <Card title="Management">
                 <p className="text-xs text-slate-400 font-bold leading-relaxed italic">
                   Revision history and version tracking are active for this entry.
                 </p>
              </Card>

              {!isNew && (
                <Card title="Record Info">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-black uppercase tracking-widest">Identifier</span>
                      <span className="text-slate-500 font-black tracking-tighter bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{id}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-black uppercase tracking-widest">Created</span>
                      <span className="text-slate-500 font-bold">{new Date(formData.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400 font-black uppercase tracking-widest">Last Update</span>
                      <span className="text-slate-500 font-bold">{new Date(formData.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </Card>
              )}

              {!isNew && (
                <Card title="Version History">
                   <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {revisions.length === 0 && !revisionsLoading && (
                        <p className="text-xs text-slate-400 font-bold italic py-2">No versions recorded yet.</p>
                      )}
                      {revisions.map((v, i) => (
                        <div 
                          key={i} 
                          onClick={() => setSelectedRevision(v)}
                          className={`flex items-start gap-3 group cursor-pointer p-2.5 -mx-2 rounded-xl transition-all border border-transparent ${v.id === activeVersionId ? 'bg-indigo-50/30 border-indigo-100/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                        >
                           <div className={`mt-1.5 h-1.5 w-1.5 rounded-full ${v.id === activeVersionId ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300'} shrink-0`} />
                           <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center gap-2">
                                 <div className="flex items-center gap-2 min-w-0">
                                    <span className={`text-[12px] font-black px-1.5 py-0.5 rounded-md shrink-0 ${v.id === activeVersionId ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>V{v.version}</span>
                                    <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white truncate">{v.user}</span>
                                 </div>
                                 {v.id !== activeVersionId && (
                                   <button 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setFormData({ ...formData, ...v.changes });
                                        setActiveVersionId(v.id);
                                      }}
                                      className="text-xs font-black uppercase text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0"
                                   >
                                      <FrameworkIcons.Refresh size={8} />
                                      Restore
                                   </button>
                                 )}
                              </div>
                              <p className="text-xs text-slate-500 font-bold truncate mt-0.5">{v.action}</p>
                              <p className="text-[12px] text-slate-400 font-black uppercase tracking-widest mt-1 opacity-60">{v.date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</p>
                           </div>
                        </div>
                      ))}
                      
                      {revisionsLoading && (
                        <div className="flex items-center justify-center py-4">
                           <FrameworkIcons.Loader size={16} className="animate-spin text-indigo-500" />
                        </div>
                      )}

                      {hasMoreRevisions && !revisionsLoading && (
                        <button 
                          onClick={loadMoreRevisions}
                          className="w-full py-3 text-[12px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-xl transition-all mt-2"
                        >
                          Load More History
                        </button>
                      )}
                   </div>
                </Card>
              )}
            </div>
          </div>
          
          <Slot name={`admin.collection.${slug}.edit.bottom`} props={{ formData, setFormData, isNew }} />
        </div>
      </div>

      {selectedRevision && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={() => setSelectedRevision(null)} />
           <Card className="relative w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h2 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Revision Details</h2>
                    <p className="text-xs text-slate-500 font-bold mt-1">{selectedRevision.date.toLocaleString()} by {selectedRevision.user}</p>
                 </div>
                 <button onClick={() => setSelectedRevision(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                    <FrameworkIcons.Close size={20} />
                 </button>
              </div>

              <div className={`rounded-xl p-4 mb-6 max-h-[40vh] overflow-y-auto ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                 <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Snapshot Changes</h3>
                 <div className="space-y-3">
                    {Object.entries(selectedRevision.changes)
                      .filter(([key]) => !['createdAt', 'updatedAt', 'id', 'created_at', 'updated_at'].includes(key))
                      .map(([key, val]) => (
                       <div key={key} className="flex flex-col gap-1 border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
                          <span className="text-[12px] font-black text-indigo-500 uppercase">{key}</span>
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </span>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="flex items-center justify-between gap-4 mt-8">
                 <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      className="text-xs font-black uppercase tracking-widest disabled:opacity-30" 
                      disabled={currentRevIndex >= revisions.length - 1}
                      onClick={() => setSelectedRevision(revisions[currentRevIndex + 1])}
                    >
                       <FrameworkIcons.Left size={14} className="mr-2" />
                       Older
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="text-xs font-black uppercase tracking-widest disabled:opacity-30" 
                      disabled={currentRevIndex <= 0}
                      onClick={() => setSelectedRevision(revisions[currentRevIndex - 1])}
                    >
                       Newer
                       <FrameworkIcons.Right size={14} className="ml-2" />
                    </Button>
                 </div>
                 <Button 
                    className="px-8 text-xs font-black uppercase tracking-widest"
                    onClick={() => {
                       setFormData({ ...formData, ...selectedRevision.changes });
                       setActiveVersionId(selectedRevision.id);
                       setSelectedRevision(null);
                    }}
                 >
                    Apply Revision
                 </Button>
              </div>
           </Card>
        </div>
      )}

      <div className={`fixed bottom-0 left-0 right-0 z-[100] border-t py-10 backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/80 border-slate-800/50 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]' 
          : 'bg-white/80 border-slate-100 shadow-lg'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8 pl-20 lg:pl-64">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-pulse" />
              <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Persistence Layer // {collection.slug.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              className="rounded-xl px-6 text-xs font-black uppercase tracking-widest text-slate-400"
              onClick={() => router.back()}
            >
              Discard Changes
            </Button>
            <Button 
              className="rounded-xl px-12 shadow-2xl shadow-indigo-600/30 text-xs font-black uppercase tracking-widest py-4.5"
              onClick={handleSubmit}
              isLoading={saving}
              icon={<FrameworkIcons.Save size={16} strokeWidth={3} />}
            >
              {isNew ? 'Create Entry' : 'Commit Changes'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        isLoading={deleting}
        title="Delete Record"
        description="Are you sure you want to delete this record? This action is permanent and cannot be undone."
        confirmLabel="Delete Permanently"
      />
    </div>
  );
}
