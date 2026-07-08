"use client";

import React from 'react';
import { AdminComponent } from '@/components/admin-component';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { AdminServices } from '@/lib/admin-services';
import type { MediaDetailsDialogProps, MediaDetailsDialogState } from '../media-page.interfaces';

const { Close: X, Edit } = FrameworkIcons;

export default class MediaDetailsDialog extends AdminComponent<MediaDetailsDialogProps, MediaDetailsDialogState> {
  state: MediaDetailsDialogState = { alt: '', caption: '' };

  private syncOpenState(): void {
    if (typeof document === 'undefined') return;
    const { item } = this.props;
    if (item) {
      document.body.style.overflow = 'hidden';
      this.setState({ alt: item.alt || '', caption: item.caption || '' });
    } else {
      document.body.style.overflow = 'unset';
    }
  }

  componentDidMount(): void {
    this.syncOpenState();
  }

  componentDidUpdate(prevProps: MediaDetailsDialogProps): void {
    if (prevProps.item?.id !== this.props.item?.id) {
      this.syncOpenState();
    }
  }

  componentWillUnmount(): void {
    if (typeof document !== 'undefined') document.body.style.overflow = 'unset';
  }

  private handleSubmit = (e?: React.FormEvent): void => {
    e?.preventDefault();
    this.props.onConfirm(this.state.alt.trim(), this.state.caption.trim());
  };

  render(): React.ReactNode {
    const { item, isLoading, onClose } = this.props;
    const theme = this.theme;
    const { alt, caption } = this.state;

    if (!item) return null;

    const mediaUrl = AdminServices.getInstance().media.resolveMediaUrl(item.url);
    const labelClass = `block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`;

    return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={onClose}
        />

        <div className={`relative w-full max-w-md my-auto rounded-3xl border shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ${
          theme === 'dark' ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200/50'
        }`}>
          <div className="flex items-start gap-4 mb-6">
            <div className={`p-3 rounded-xl flex-shrink-0 ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}>
              <Edit size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                Edit Details
              </h3>
              <p className={`mt-1 text-sm leading-relaxed truncate ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`} title={item.originalName}>
                {item.originalName}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`p-1 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-500 hover:text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
            >
              <X size={20} />
            </button>
          </div>

          {item.mimeType.startsWith('image/') && (
            <div className={`mb-6 rounded-xl overflow-hidden border ${theme === 'dark' ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
              <img src={mediaUrl} alt={alt || item.originalName} className="w-full max-h-40 object-contain" />
            </div>
          )}

          <form onSubmit={this.handleSubmit} className="space-y-5">
            <div>
              <label className={labelClass}>Alt text</label>
              <Input
                type="text"
                placeholder="Describe the image for screen readers and SEO…"
                value={alt}
                onChange={(e) => this.setState({ alt: e.target.value })}
                disabled={isLoading}
                className="w-full"
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Caption</label>
              <Input
                type="text"
                placeholder="Optional caption shown with the asset…"
                value={caption}
                onChange={(e) => this.setState({ caption: e.target.value })}
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button variant="ghost" className="flex-1" onClick={onClose} type="button" disabled={isLoading}>
                Cancel
              </Button>
              <Button variant="primary" className="flex-1" type="submit" isLoading={isLoading}>
                Save Details
              </Button>
            </div>
          </form>
        </div>
      </div>
    </RootFramework>
    );
  }
}
