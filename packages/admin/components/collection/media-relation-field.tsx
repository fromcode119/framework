"use client";

import React from 'react';
import { FrameworkIcons } from '@/lib/icons';
import { MediaPicker } from '@/components/media/media-picker';

interface MediaRelationFieldProps {
  value: any;
  onChange: (val: any) => void;
  theme: string;
}

export const MediaRelationField: React.FC<MediaRelationFieldProps> = ({ value, onChange, theme }) => {
  const [open, setOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<{ url?: string; filename?: string } | null>(null);

  const handleSelect = (item: any) => {
    onChange(item?.id || item?._id || item);
    setPreview({ url: item.url, filename: item.filename });
  };

  return (
    <div className="space-y-3">
      {preview?.url ? (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
          <img src={preview.url} alt={preview.filename || 'Selected media'} className="w-full h-full object-cover" />
        </div>
      ) : value ? (
        <div className={`px-3.5 h-10 flex items-center rounded-lg text-xs font-semibold ${theme === 'dark' ? 'bg-slate-900/50 text-slate-200 border border-slate-800' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
          Selected media ID: {String(value)}
        </div>
      ) : (
        <div className={`px-3.5 h-10 flex items-center rounded-lg text-xs font-semibold ${theme === 'dark' ? 'bg-slate-900/30 text-slate-500 border border-dashed border-slate-800' : 'bg-slate-50 text-slate-400 border border-dashed border-slate-200'}`}>
          No media selected
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold tracking-wide shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
      >
        <FrameworkIcons.Image size={14} />
        Select Media
      </button>

      {open && (
        <MediaPicker
          onSelect={(item) => {
            handleSelect(item);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
};
