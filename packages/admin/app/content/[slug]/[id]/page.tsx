"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Slot, usePlugins } from '@fromcode/react';
import { useTheme } from '@/components/ThemeContext';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FrameworkIcons } from '@/lib/icons';
import Cookies from 'js-cookie';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ENDPOINTS } from '@/lib/constants';

const TagField = ({ field, value, onChange, theme }: { field: any, value: any, onChange: (val: any) => void, theme: string }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { slug } = useParams() as { slug: string };

  const tags = React.useMemo(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return [];
      }
    }
    return [];
  }, [value]);

  useEffect(() => {
    if (inputValue.length < 1) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const allSuggestions = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${slug}/suggestions/${field.name}`);
        if (Array.isArray(allSuggestions)) {
          setSuggestions(
            allSuggestions
              .filter(s => typeof s === 'string' && s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s))
          );
        }
      } catch (err) {
        console.error("Failed to fetch suggestions");
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [inputValue, slug, field.name, tags]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <div className={`w-full min-h-[48px] rounded-xl py-2 px-3 border flex flex-wrap gap-2 transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 focus-within:border-indigo-500/50' : 'bg-white border-slate-200 focus-within:border-indigo-500 shadow-sm'}`}>
        {tags.map((tag: string, i: number) => (
          <span key={tag} className="bg-indigo-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
            {tag}
            <button 
              type="button" 
              onClick={() => {
                const newTags = [...tags];
                newTags.splice(i, 1);
                onChange(newTags);
              }}
              className="hover:text-indigo-200 transition-colors"
            >
              <FrameworkIcons.Close size={12} />
            </button>
          </span>
        ))}
        <input 
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Add tag and press Enter..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(inputValue);
            }
          }}
          className={`flex-1 bg-transparent min-w-[150px] outline-none text-sm ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}
        />
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className={`absolute z-50 w-full mt-2 rounded-xl border shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-200'}`}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addTag(suggestion)}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : 'hover:bg-slate-100 text-slate-700 hover:text-indigo-600'}`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function CollectionEditPage() {
  const { slug, id } = useParams() as { slug: string, id: string };
  const router = useRouter();
  const { collections } = usePlugins();
  const { theme } = useTheme();
  
  const isNew = id === 'new';
  const collection = collections.find(c => c.slug === slug);
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (isNew || !collection) return;

    async function fetchEntry() {
      try {
        const result = await api.get(`${ENDPOINTS.COLLECTIONS.BASE}/${slug}/${id}`);
        setFormData(result);
      } catch (err) {
        console.error("Failed to fetch entry:", err);
        setStatus({ type: 'error', message: 'Failed to load entry' });
      } finally {
        setLoading(false);
      }
    }

    fetchEntry();
  }, [slug, id, isNew, collection]);

  if (!collection) {
    return <div>Collection {slug} not found</div>;
  }

  const handleInputChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    try {
      const url = isNew 
        ? `${ENDPOINTS.COLLECTIONS.BASE}/${slug}` 
        : `${ENDPOINTS.COLLECTIONS.BASE}/${slug}/${id}`;

      const result = await (isNew ? api.post(url, formData) : api.put(url, formData));

      setStatus({ type: 'success', message: `Entry ${isNew ? 'created' : 'updated'} successfully` });
      if (isNew) {
        router.push(`/content/${slug}/${result.id}`);
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
      await api.delete(`${ENDPOINTS.COLLECTIONS.BASE}/${slug}/${id}`);
      router.push(`/content/${slug}`);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="flex flex-col h-full -mx-8 -mt-8 overflow-hidden bg-slate-50/30 dark:bg-transparent">
      {/* Header section with white high-contrast style */}
      <div className={`p-8 border-b ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'} bg-white dark:bg-transparent shadow-sm dark:shadow-none`}>
        <div className="max-w-[1200px] mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <Link 
              href={`/content/${slug}`}
              className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-indigo-600'}`}
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
              <h1 className="text-2xl font-black uppercase tracking-tight">
                {isNew ? `Create ${collection.name || collection.slug}` : `Edit ${collection.admin?.useAsTitle && formData[collection.admin.useAsTitle] ? formData[collection.admin.useAsTitle] : (collection.name || 'Entry')}`}
              </h1>
              <p className="text-slate-500 font-medium text-sm mt-1">
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
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button 
                className="px-8" 
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

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-[1200px] mx-auto">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                  {collection.fields
                    .filter(f => !f.admin?.hidden)
                    .map((field) => (
                    <div key={field.name} className={`${field.type === 'textarea' || field.type === 'richText' || field.admin?.component === 'Tags' || field.type === 'json' ? 'md:col-span-2' : ''}`}>
                      <label className={`block text-[11px] font-black uppercase tracking-widest mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                        {field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}
                        {field.required && <span className="text-rose-500 ml-1 font-bold font-sans">*</span>}
                      </label>
                      
                      {field.admin?.component === 'Tags' || field.type === 'json' ? (
                        <TagField 
                          field={field} 
                          value={formData[field.name]} 
                          onChange={(val) => handleInputChange(field.name, val)}
                          theme={theme}
                        />
                      ) : field.type === 'textarea' ? (
                        <textarea 
                          value={formData[field.name] || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          disabled={saving}
                          className={`w-full min-h-[160px] rounded-2xl py-3 px-4 outline-none border transition-all text-sm font-medium ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm'} ${field.required && !formData[field.name] ? 'border-amber-100' : ''}`}
                          placeholder={`Enter ${field.label || field.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}...`}
                        />
                      ) : field.type === 'password' || (field.name === 'password' && isNew) ? (
                         <Input 
                          type="password"
                          value={formData[field.name] || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder="••••••••"
                          disabled={saving}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={formData[field.name] || field.defaultValue || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          disabled={saving}
                          className={`w-full rounded-2xl py-3 px-4 outline-none border transition-all text-sm font-medium appearance-none ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 shadow-sm'}`}
                        >
                          <option value="">Select an option...</option>
                          {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <Input 
                          type={field.type === 'number' ? 'number' : 'text'}
                          value={formData[field.name] || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder={`Enter ${field.label || field.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}...`}
                          disabled={saving}
                        />
                      )}
                      {field.admin?.description && (
                        <p className="mt-2 text-xs text-slate-400 font-medium italic">{field.admin.description}</p>
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
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold uppercase tracking-widest">ID</span>
                      <span className="text-slate-400 font-mono">{id}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold uppercase tracking-widest">Created</span>
                      <span className="text-slate-400 font-medium">{new Date(formData.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold uppercase tracking-widest">Updated</span>
                      <span className="text-slate-400 font-medium">{new Date(formData.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
          
          <Slot name={`admin.collection.${slug}.edit.bottom`} props={{ formData, setFormData, isNew }} />
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
