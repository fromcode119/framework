"use client";

import React from 'react';
import Link from 'next/link';
import { FrameworkIcons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface EditHeaderProps {
  collection: any;
  pluginSlug: string;
  slug: string;
  id: string;
  isNew: boolean;
  theme: string;
  resolvedTitleValue: string;
  changeSummary: string;
  setChangeSummary: (val: string) => void;
  formData: any;
  getPreviewUrl: () => string;
  showPreview: boolean;
  statusOptions: { label: string; value: string }[];
  currentStatusValue: string;
  handleInputChange: (name: string, value: any) => void;
  handleSubmit: (e: any, summary: string) => void;
  saving: boolean;
  setShowDeleteConfirm: (val: boolean) => void;
}

export const EditHeader: React.FC<EditHeaderProps> = ({
  collection,
  pluginSlug,
  slug,
  id,
  isNew,
  theme,
  resolvedTitleValue,
  changeSummary,
  setChangeSummary,
  formData,
  getPreviewUrl,
  showPreview,
  statusOptions,
  currentStatusValue,
  handleInputChange,
  handleSubmit,
  saving,
  setShowDeleteConfirm
}) => {
  return (
    <div data-edit-header className={`sticky top-0 z-40 border-b backdrop-blur-3xl transition-all duration-300 ${
      theme === 'dark' 
        ? 'bg-slate-950/80 border-slate-800/50 shadow-2xl shadow-black/20' 
        : 'bg-white/80 border-slate-100 shadow-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
        <div className="flex items-center gap-2 mb-4">
          <Link 
            href={`/${pluginSlug}/${slug}`}
            className={`flex items-center gap-1.5 text-[10px] font-semibold transition-all hover:-translate-x-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}
          >
            <FrameworkIcons.Left size={14} />
            {collection.name || slug}
          </Link>
          <span className="text-slate-300">/</span>
          <span className={`text-[10px] font-semibold ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
            {isNew ? 'New Entry' : (id.length > 8 ? `${id.substring(0, 8)}...` : id)}
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className={`text-2xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {isNew 
                ? `Create ${collection.name || collection.slug}` 
                : (resolvedTitleValue || `Untitled ${collection.name || 'Entry'}`)
              }
            </h1>
            <p className="text-slate-500 font-medium text-sm tracking-tight opacity-70 mt-1">
              {isNew ? `Define a new record for ${collection.name || collection.slug}` : `Modify existing ${resolvedTitleValue || collection.name || 'entry'}`}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {!isNew && (
              <div className="hidden lg:block relative group">
                 <Input 
                    placeholder="Commit summary (optional)"
                    value={changeSummary}
                    onChange={(e) => setChangeSummary(e.target.value)}
                    className="w-48 xl:w-64"
                    inputClassName="text-[10px] font-semibold h-10 bg-transparent border-slate-200 dark:border-slate-800 transition-all placeholder:opacity-50"
                 />
              </div>
            )}
            {formData?.scheduledPublishAt && (formData.status === 'draft' || !formData.status) && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold text-[10px] animate-pulse">
                <FrameworkIcons.Clock size={12} />
                {new Date(formData.scheduledPublishAt).toLocaleDateString()}
              </div>
            )}
            {showPreview && (
              <a 
                href={getPreviewUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className={`box-border appearance-none h-10 px-4 rounded-lg outline-none border transition-all duration-200 shadow-sm inline-flex items-center justify-center gap-2 leading-none text-[10px] font-semibold ${
                  theme === 'dark' 
                    ? 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-indigo-500/50 hover:text-white focus:border-indigo-500 focus:ring-0'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-500 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                }`}
              >
                <FrameworkIcons.Eye size={14} />
                Preview
              </a>
            )}
            {statusOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  value={currentStatusValue || statusOptions[0].value}
                  onChange={(value) => handleInputChange('status', value)}
                  options={statusOptions}
                  searchable={false}
                  size="md"
                  className="w-full md:w-64 lg:w-72"
                  triggerClassName="h-10 px-4 text-sm font-bold rounded-xl"
                />
              </div>
            )}
            
            <Button 
              className="h-10 px-6 rounded-lg font-semibold text-[10px] shadow-lg shadow-indigo-600/20" 
              onClick={(e) => {
                 handleSubmit(e, changeSummary);
                 setChangeSummary('');
              }}
              isLoading={saving}
              icon={<FrameworkIcons.Save size={14} />}
            >
              {isNew ? 'Create' : 'Save'}
            </Button>

            {!isNew && (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className={`h-10 w-10 inline-flex items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm ${theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20' : ''}`}
              >
                <FrameworkIcons.Trash size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
