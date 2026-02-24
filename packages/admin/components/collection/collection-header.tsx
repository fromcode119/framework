import React from 'react';
import Link from 'next/link';
import { FrameworkIcons } from '../../lib/icons';
import { Button } from '../../components/ui/button';

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
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <div className="flex items-center gap-2 mb-3">
          <Link 
            href={`/${pluginSlug}/${slug}`}
            className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all hover:-translate-x-1 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}
          >
            <FrameworkIcons.Left size={12} />
            {collection.name || slug}
          </Link>
          <span className="text-slate-300">/</span>
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-300' : 'text-slate-500'}`}>
            {isNew ? 'New Entry' : (id.length > 8 ? `${id.substring(0, 8)}...` : id)}
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              {title}
            </h1>
            <p className="text-slate-500 font-medium text-xs tracking-tight opacity-70 mt-0.5">
              {subtitle}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {scheduledPublishAt && (status === 'draft' || !status) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 font-semibold uppercase tracking-wider text-[10px] animate-pulse">
                <FrameworkIcons.Clock size={12} />
                Scheduled: {new Date(scheduledPublishAt).toLocaleDateString()}
              </div>
            )}
            {showPreview && (
              <a 
                href={previewUrl}
                target="_blank"
                className={`flex items-center gap-2 h-10 px-4 rounded-lg border text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  theme === 'dark' 
                    ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700' 
                    : 'bg-white border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-100'
                }`}
              >
                <FrameworkIcons.Eye size={12} />
                Preview
              </a>
            )}
            
            <Button 
              variant="ghost"
              onClick={onDiscard}
              className="px-4 font-semibold uppercase tracking-wider text-[10px] text-slate-400"
              size="md"
            >
              Discard Changes
            </Button>
            <Button 
              className="px-6 font-semibold uppercase tracking-wider text-[10px] shadow-lg shadow-indigo-600/20" 
              onClick={onSave}
              isLoading={saving}
              size="md"
              icon={<FrameworkIcons.Save size={16} />}
            >
              {isNew ? 'Create' : 'Save Changes'}
            </Button>

            {!isNew && onDelete && (
              <button 
                onClick={onDelete}
                className={`w-10 h-10 flex items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm ${theme === 'dark' ? 'bg-rose-500/10 border-rose-500/20' : ''}`}
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
