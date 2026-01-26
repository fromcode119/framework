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
    <div className="w-full space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <Link 
          href={`/content/${slug}`}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <FrameworkIcons.Left size={16} />
          Back to {collection.name || slug}
        </Link>
        {!isNew && (
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors text-sm font-bold"
          >
            <FrameworkIcons.Trash size={16} />
            Delete Entry
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          {isNew ? `New ${collection.name || collection.slug.charAt(0).toUpperCase() + collection.slug.slice(1)}` : `Edit ${collection.admin?.useAsTitle && formData[collection.admin.useAsTitle] ? formData[collection.admin.useAsTitle] : (collection.name || 'Entry')}`}
        </h1>
        <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
          {collection.name || collection.slug.charAt(0).toUpperCase() + collection.slug.slice(1)} Record
        </p>
      </div>

      {status && (
        <div className={`p-4 rounded-xl flex items-start gap-3 border ${status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
          {status.type === 'success' ? <FrameworkIcons.Check size={20} className="mt-0.5" /> : <FrameworkIcons.Alert size={20} className="mt-0.5" />}
          <div>
            <p className="font-bold">{status.type === 'success' ? 'Success' : 'Error'}</p>
            <p className="text-sm opacity-90">{status.message}</p>
          </div>
        </div>
      )}

      <Slot name={`admin.collection.${slug}.edit.top`} props={{ formData, setFormData, isNew }} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <Card className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {collection.fields
                .filter(f => !f.admin?.hidden)
                .map((field) => (
                <div key={field.name} className={`${field.type === 'textarea' || field.type === 'richText' || field.admin?.component === 'Tags' || field.type === 'json' ? 'md:col-span-2' : ''}`}>
                  <label className={`block text-sm font-bold mb-2 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    {field.label || field.name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}
                    {field.required && <span className="text-rose-500 ml-1">*</span>}
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
                      className={`w-full h-32 rounded-xl py-3 px-4 outline-none border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`}
                      placeholder={`Enter ${field.label || field.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}...`}
                    />
                  ) : field.type === 'password' || (field.name === 'password' && isNew) ? (
                     <Input 
                      type="password"
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={`Enter ${field.label || field.name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}...`}
                      disabled={saving}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={formData[field.name] || field.defaultValue || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      disabled={saving}
                      className={`w-full rounded-xl py-3 px-4 outline-none border transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-white focus:border-indigo-500/50' : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500 shadow-sm'}`}
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
                    <p className="mt-1.5 text-xs text-slate-500 italic">{field.admin.description}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div className="flex items-center justify-end gap-4 pb-8">
             <Button 
              variant="ghost" 
              type="button" 
              onClick={() => router.back()}
              disabled={saving}
             >
               Cancel
             </Button>
             <Button 
              className="flex items-center gap-2 px-8" 
              type="submit"
              isLoading={saving}
             >
               <FrameworkIcons.Save size={18} />
               {isNew ? 'Create' : 'Save Changes'}
             </Button>
          </div>
        </form>

        <div className="space-y-6">
          <Slot name={`admin.collection.${slug}.edit.sidebar`} props={{ formData, setFormData, isNew }} />
          <Slot name="admin.collection.edit.sidebar" props={{ formData, setFormData, isNew }} />
        </div>
      </div>
      
      <Slot name={`admin.collection.${slug}.edit.bottom`} props={{ formData, setFormData, isNew }} />

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
