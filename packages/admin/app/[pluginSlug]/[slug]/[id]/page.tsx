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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FrameworkIcons } from '@/lib/icons';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

const TagFieldLocal = ({ field, value, onChange, theme, collectionSlug }: { field: any, value: any, onChange: (val: any) => void, theme: string, collectionSlug: string }) => {
  return (
    <TagField 
      collectionSlug={collectionSlug}
      fieldName={field.name}
      value={value}
      onChange={onChange}
      theme={theme}
      sourceCollection={field.admin?.sourceCollection}
      sourceField={field.admin?.sourceField}
    />
  );
};

export default function CollectionEditPage() {
  const { pluginSlug, slug, id } = useParams() as { pluginSlug: string, slug: string, id: string };
  const router = useRouter();
  const { collections } = usePlugins();
  const { theme } = useTheme();
  
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

  const resolvedSlug = collection?.slug || slug;

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

    async function fetchEntry() {
      try {
        const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${resolvedSlug}/${id}`);
        setFormData(result);
        if (result.slug) setSlugManuallyEdited(true);
      } catch (err) {
        console.error("Failed to fetch entry:", err);
        setStatus({ type: 'error', message: 'Failed to load entry' });
      } finally {
        setLoading(false);
      }
    }

    fetchEntry();
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
    return <div>Collection {slug} not found</div>;
  }

  const handleInputChange = (name: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };

      // Auto-generate slug logic
      const sourceField = collection.admin?.useAsTitle || (collection.fields.find(f => f.name === 'name' || f.name === 'title')?.name);
      
      if (name === sourceField && !slugManuallyEdited && isNew) {
        newData.slug = slugify(value);
      }

      if (name === 'slug') {
        setSlugManuallyEdited(true);
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
              className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-all hover:-translate-x-1 ${theme === 'dark' ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-indigo-600'}`}
            >
              <FrameworkIcons.Left size={14} />
              {collection.name || slug}
            </Link>
            <span className="text-slate-300">/</span>
            <span className={`text-[11px] font-black uppercase tracking-widest ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
              {isNew ? 'New Entry' : (id.length > 8 ? `${id.substring(0, 8)}...` : id)}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className={`text-2xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {isNew ? `Create ${collection.name || collection.slug}` : `Edit ${collection.admin?.useAsTitle && formData[collection.admin.useAsTitle] ? formData[collection.admin.useAsTitle] : (collection.name || 'Entry')}`}
              </h1>
              <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70 mt-1">
                {isNew ? 'Define a new record for this collection' : `Modify existing ${collection.name || collection.slug} entry`}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {!isNew && (
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className={`p-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm ${theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20' : ''}`}
                >
                  <FrameworkIcons.Trash size={20} />
                </button>
              )}
              <Button 
                variant="ghost" 
                type="button" 
                className="font-bold text-slate-400"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                className="px-8 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-indigo-600/30" 
                onClick={handleSubmit}
                isLoading={saving}
                icon={<FrameworkIcons.Save size={18} />}
              >
                {isNew ? 'Create' : 'Save Changes'}
              </Button>
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                  {collection.fields
                    .filter(f => !f.admin?.hidden)
                    .map((field) => (
                    <div key={field.name} className={`${field.type === 'textarea' || field.type === 'richText' || field.admin?.component === 'Tags' || field.type === 'json' ? 'md:col-span-2' : ''}`}>
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-3 pl-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                        {field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}
                        {field.required && <span className="text-rose-500 ml-1 font-bold font-sans">*</span>}
                      </label>
                      
                      {field.admin?.component === 'Tags' || field.type === 'json' ? (
                        <TagFieldLocal 
                          field={field} 
                          value={formData[field.name]} 
                          onChange={(val) => handleInputChange(field.name, val)}
                          theme={theme}
                          collectionSlug={resolvedSlug}
                        />
                      ) : field.type === 'textarea' ? (
                        <textarea 
                          value={formData[field.name] || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          disabled={saving}
                          className={`w-full min-h-[160px] rounded-2xl py-3 px-4 outline-none border transition-all text-sm font-bold ${
                            theme === 'dark' 
                              ? 'bg-slate-900/50 border-slate-800 text-white focus:border-indigo-500/50 focus:bg-slate-900' 
                              : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:bg-slate-50 shadow-sm'
                          } ${field.required && !formData[field.name] ? 'border-amber-100' : ''}`}
                          placeholder={`Enter ${field.label || field.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}...`}
                        />
                      ) : field.type === 'password' || (field.name === 'password' && isNew) ? (
                         <Input 
                          type="password"
                          value={formData[field.name] || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder="••••••••"
                          disabled={saving}
                          className="font-bold"
                        />
                      ) : field.type === 'select' ? (
                        <Select
                          value={formData[field.name] || field.defaultValue || ''}
                          options={field.options || []}
                          onChange={(val) => handleInputChange(field.name, val)}
                          disabled={saving}
                          theme={theme}
                        />
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
                            <div className="absolute top-full left-0 mt-2 flex items-center gap-2 text-[10px] font-bold text-amber-500 animate-in fade-in slide-in-from-top-1 px-1">
                               <FrameworkIcons.Alert size={12} />
                               <span>{slugWarning}</span>
                            </div>
                          )}
                          {field.name === 'slug' && !slugManuallyEdited && isNew && formData[field.name] && (
                             <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1.5 px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-lg text-[8px] font-black uppercase tracking-widest animate-pulse border border-indigo-500/20 pointer-events-none">
                                <FrameworkIcons.Refresh size={8} />
                                Auto
                             </div>
                          )}
                        </div>
                      )}
                      {field.admin?.description && (
                        <p className="mt-2.5 text-[10px] text-slate-400 font-bold uppercase tracking-tight opacity-60 ml-1">{field.admin.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Slot name={`admin.collection.${slug}.edit.sidebar`} props={{ formData, setFormData, isNew }} />
              <Slot name="admin.collection.edit.sidebar" props={{ formData, setFormData, isNew }} />
              
              {!isNew && (
                <Card title="Record Info">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 font-black uppercase tracking-widest">Identifier</span>
                      <span className="text-slate-500 font-black tracking-tighter bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{id}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 font-black uppercase tracking-widest">Created</span>
                      <span className="text-slate-500 font-bold">{new Date(formData.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400 font-black uppercase tracking-widest">Last Update</span>
                      <span className="text-slate-500 font-bold">{new Date(formData.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </Card>
              )}

              <Card title="Management">
                 <p className="text-[11px] text-slate-400 font-bold leading-relaxed mb-6 italic">
                   Version control and audit trails are active for this entry.
                 </p>
                 <Button 
                    className="w-full py-4 font-black uppercase tracking-widest text-[11px] rounded-2xl" 
                    onClick={handleSubmit}
                    isLoading={saving}
                  >
                    {isNew ? 'Create Entry' : 'Commit Changes'}
                  </Button>
              </Card>
            </div>
          </div>
          
          <Slot name={`admin.collection.${slug}.edit.bottom`} props={{ formData, setFormData, isNew }} />
        </div>
      </div>

      <div className={`mt-auto border-t py-12 backdrop-blur-3xl transition-all duration-300 ${
        theme === 'dark' 
          ? 'bg-slate-950/40 border-slate-800' 
          : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.6)] animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Persistence Layer // {collection.slug.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <Button 
              variant="ghost" 
              className="rounded-xl px-6 text-[10px] font-black uppercase tracking-widest text-slate-400"
              onClick={() => router.back()}
            >
              Discard
            </Button>
            <Button 
              className="rounded-xl px-10 shadow-xl shadow-indigo-600/30 text-[10px] font-black uppercase tracking-widest py-4"
              onClick={handleSubmit}
              isLoading={saving}
              icon={<FrameworkIcons.Save size={16} strokeWidth={3} />}
            >
              Commit Changes
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
