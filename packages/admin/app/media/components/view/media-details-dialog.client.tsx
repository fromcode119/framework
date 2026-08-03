import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { Platform, bound, prop, state } from '@fromcode119/reactor';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { Input } from '@/components/ui/view/input.client';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { AdminServices } from '@/lib/admin-services';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';

export class MediaDetailsDialog extends AdminComponent {
  @prop declare item: IMediaItem | null;
  @prop declare isLoading: boolean;
  @prop declare onClose: () => void;
  @prop declare onConfirm: (alt: string, caption: string) => void;

  @state alt = '';
  @state caption = '';

  private syncOpenState(): void {
    if (!Platform.isBrowser) return;
    const item = this.item;
    if (item) {
      document.body.style.overflow = 'hidden';
      this.alt = item.alt || '';
      this.caption = item.caption || '';
    } else {
      document.body.style.overflow = 'unset';
    }
  }

  componentDidMount(): void {
    this.syncOpenState();
  }

  componentDidUpdate(prevProps: { item: IMediaItem | null }): void {
    if (prevProps.item?.id !== this.item?.id) {
      this.syncOpenState();
    }
  }

  componentWillUnmount(): void {
    if (Platform.isBrowser) document.body.style.overflow = 'unset';
  }

  @bound private handleSubmit(e?: FormEvent): void {
    e?.preventDefault();
    this.onConfirm(this.alt.trim(), this.caption.trim());
  }

  @bound private handleAltChange(e: ChangeEvent<HTMLInputElement>): void {
    this.alt = e.target.value;
  }

  @bound private handleCaptionChange(e: ChangeEvent<HTMLInputElement>): void {
    this.caption = e.target.value;
  }

  render(): ReactNode {
    const item = this.item;
    const isLoading = this.isLoading;
    const onClose = this.onClose;
    const theme = this.theme;
    const alt = this.alt;
    const caption = this.caption;

    if (!item) return null;

    const mediaUrl = AdminServices.getInstance().media.resolveMediaUrl(item.url);
    const labelClass = `block text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`;

    return (
    <RootFramework>
      <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300"
          onClick={onClose}
        />

        <div className={`relative w-full max-w-md my-auto rounded-xl border shadow-2xl p-8 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 ${
          theme === ThemeMode.DARK ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-slate-100 shadow-slate-200/50'
        }`}>
          <div className="flex items-start gap-4 mb-6">
            <div className={`p-3 rounded-xl flex-shrink-0 ${theme === ThemeMode.DARK ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}>
              <FrameworkIcons.Edit size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-lg font-bold tracking-tight ${theme === ThemeMode.DARK ? 'text-white' : 'text-slate-900'}`}>
                Edit Details
              </h3>
              <p className={`mt-1 text-sm leading-relaxed truncate ${theme === ThemeMode.DARK ? 'text-slate-400' : 'text-slate-500'}`} title={item.originalName}>
                {item.originalName}
              </p>
            </div>
            <button
              onClick={onClose}
              className={`p-1 rounded-lg transition-colors ${theme === ThemeMode.DARK ? 'hover:bg-slate-800 text-slate-500 hover:text-white' : 'hover:bg-slate-50 text-slate-400 hover:text-slate-900'}`}
            >
              <FrameworkIcons.Close size={20} />
            </button>
          </div>

          {item.mimeType.startsWith('image/') && (
            <div className={`mb-6 rounded-xl overflow-hidden border ${theme === ThemeMode.DARK ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
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
                onChange={this.handleAltChange}
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
                onChange={this.handleCaptionChange}
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button variant={ButtonVariant.GHOST} className="flex-1" onClick={onClose} type="button" disabled={isLoading}>
                Cancel
              </Button>
              <Button variant={ButtonVariant.PRIMARY} className="flex-1" type="submit" isLoading={isLoading}>
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
