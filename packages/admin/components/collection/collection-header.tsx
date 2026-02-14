import React from 'react';
import Link from 'next/link';
import { FrameworkIcons } from '@/lib/icons';
import { Button } from '@/components/ui/button';

interface CollectionHeaderProps {
  collection: any;
  pluginSlug: string;
  slug: string;
  id: string;
  isNew: boolean;
  title: string;
  subtitle: string;
  onSave: () => void;
  onDiscard: () => void;
  onDelete?: () => void;
  saving?: boolean;
  showPreview?: boolean;
  previewUrl?: string;
  theme: string;
  scheduledPublishAt?: string;
  status?: string;
}

export const CollectionHeader: React.FC<CollectionHeaderProps> = ({
  collection,
  pluginSlug,
  slug,
  id,
  isNew,
  title,
  subtitle,
  onSave,
  onDiscard,
  onDelete,
  saving = false,
  showPreview = false,
  previewUrl = '#',
  theme,
  scheduledPublishAt,
  status
}) => {
  return (
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
              {title}
            </h1>
            <p className="text-slate-500 font-bold text-sm tracking-tight opacity-70 mt-1">
              {subtitle}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {scheduledPublishAt && (status === 'draft' || !status) && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 font-black uppercase tracking-widest text-[12px] animate-pulse">
                <FrameworkIcons.Clock size={14} />
                Scheduled: {new Date(scheduledPublishAt).toLocaleDateString()}
              </div>
            )}
            {showPreview && (
              <a 
                href={previewUrl}
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
            
            <Button 
              variant="ghost"
              onClick={onDiscard}
              className="rounded-2xl px-6 font-black uppercase tracking-widest text-xs text-slate-400"
            >
              Discard Changes
            </Button>
            <Button 
              className="px-8 font-black uppercase tracking-widest text-[11px] shadow-xl shadow-indigo-600/30" 
              onClick={onSave}
              isLoading={saving}
              icon={<FrameworkIcons.Save size={18} />}
            >
              {isNew ? 'Create' : 'Save Changes'}
            </Button>

            {!isNew && onDelete && (
              <button 
                onClick={onDelete}
                className={`p-3 rounded-xl border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm ${theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20' : ''}`}
              >
                <FrameworkIcons.Trash size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
