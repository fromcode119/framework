import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { PureReactor, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { MediaPicker } from '@/components/media/view/media-picker.client';
import type { IMediaRelationPreview } from '@/components/collection/interfaces/media-relation-preview.interface';

export class MediaRelationFieldView extends PureReactor {
  @prop declare theme: ThemeMode;
  @prop declare hasMany: boolean;
  @prop declare open: boolean;
  @prop declare preview: IMediaRelationPreview | null;
  @prop declare selectedIds: Array<string | number>;
  @prop declare onOpenChange: (open: boolean) => void;
  @prop declare onSelect: (item: any) => void;

  render(): ReactNode {
    const { theme, hasMany, open, preview, selectedIds, onOpenChange, onSelect } = this;
    const selectedLabel = hasMany ? selectedIds.join(', ') : String(selectedIds[0] || '');

    return (
    <div className="space-y-3">
      {preview?.url ? (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
          <img src={preview.url} alt={preview.filename || 'Selected media'} className="w-full h-full object-cover" />
        </div>
      ) : selectedIds.length > 0 ? (
        <div className={`px-3.5 h-10 flex items-center rounded-lg text-xs font-semibold ${theme === ThemeMode.DARK ? 'bg-slate-900/50 text-slate-200 border border-slate-800' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
          Selected media ID{hasMany && selectedIds.length > 1 ? 's' : ''}: {selectedLabel}
        </div>
      ) : (
        <div className={`px-3.5 h-10 flex items-center rounded-lg text-xs font-semibold ${theme === ThemeMode.DARK ? 'bg-slate-900/30 text-slate-500 border border-dashed border-slate-800' : 'bg-slate-50 text-slate-400 border border-dashed border-slate-200'}`}>
          No media selected
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold tracking-wide shadow-sm hover:shadow-md active:scale-[0.99] transition-all"
      >
        <FrameworkIcons.Image size={14} />
        Select Media
      </button>

      {open && (
        <MediaPicker
          onSelect={(item) => {
            onSelect(item);
            onOpenChange(false);
          }}
          onClose={() => onOpenChange(false)}
        />
      )}
    </div>
    );
  }
}
