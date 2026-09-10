import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ThemeMode } from '@fromcode119/core/client';
import type { ReactNode } from 'react';
import { Platform, bound, prop } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { Button } from '@/components/ui/view/button.client';
import { FrameworkIcons, RootFramework } from '@fromcode119/react';
import { AdminServices } from '@/lib/admin-services';
import type { IMediaItem } from '@/app/media/interfaces/media-item.interface';

/**
 * What the library knows about an asset it cannot change.
 *
 * A theme asset ships inside the theme bundle: there is no record behind it, so the edit dialog has
 * nothing to save and rendering it would offer an Alt-text box that writes nowhere. Clicking the tile
 * still has to answer something — the operator clicked a picture to find out what it is — so it opens
 * THIS instead: the file's own facts, and the two things that can actually be done with it (open the
 * file, download it). Every line is read off the asset; a fact the listing did not report is omitted
 * rather than shown as an empty or zero value.
 */
export class MediaAssetInfoDialog extends AdminComponent {
  @prop declare item: IMediaItem | null;
  @prop declare onClose: () => void;

  componentDidMount(): void {
    if (Platform.isBrowser) document.body.style.overflow = 'hidden';
  }

  componentWillUnmount(): void {
    if (Platform.isBrowser) document.body.style.overflow = 'unset';
  }

  private get mediaUrl(): string {
    return AdminServices.getInstance().media.resolveMediaUrl(this.item?.url || '');
  }

  /** `[label, value]` for every fact the asset actually reports — nothing invented, nothing blank. */
  private get facts(): Array<[string, string]> {
    const item = this.item;
    if (!item) return [];
    const rows: Array<[string, string]> = [['File name', item.originalName]];
    if (item.relativePath) rows.push(['Path in theme', item.relativePath]);
    rows.push(['Type', item.mimeType]);
    const bytes = Number(item.fileSize);
    if (Number.isFinite(bytes) && bytes > 0) rows.push(['Size', AdminServices.getInstance().formatter.formatSize(bytes)]);
    if (item.width && item.height) rows.push(['Dimensions', `${item.width} × ${item.height}`]);
    rows.push(['URL', item.url]);
    return rows;
  }

  @bound private openFile(): void {
    if (Platform.isBrowser) window.open(this.mediaUrl, '_blank', 'noopener,noreferrer');
  }

  private renderFact(label: string, value: string): ReactNode {
    return (
      <div key={label} className="grid grid-cols-[110px_1fr] gap-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
        <span className="min-w-0 break-all text-[12px] text-slate-700 dark:text-slate-300">{value}</span>
      </div>
    );
  }

  render(): ReactNode {
    const item = this.item;
    if (!item) return null;
    const dark = this.theme === ThemeMode.DARK;

    return (
      <RootFramework>
        <div className="fixed inset-0 z-[500] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md" onClick={this.onClose} />
          <div className={`relative my-auto max-h-[calc(100vh-3rem)] w-full max-w-md overflow-y-auto rounded-xl border p-8 shadow-2xl ${
            dark ? 'border-slate-800 bg-slate-900 shadow-black/50' : 'border-slate-100 bg-white shadow-slate-200/50'
          }`}>
            <div className="mb-6 flex items-start gap-4">
              <div className={`flex-shrink-0 rounded-xl p-3 ${dark ? 'bg-indigo-500/10 text-indigo-500' : 'bg-indigo-50 text-indigo-600'}`}>
                <FrameworkIcons.File size={24} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>Asset details</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                  This file ships inside the active theme, so the library can show it but never change it.
                </p>
              </div>
              <button onClick={this.onClose} className="rounded-lg p-1 text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-white">
                <FrameworkIcons.Close size={20} />
              </button>
            </div>

            {item.mimeType.startsWith('image/') ? (
              <div className={`mb-6 overflow-hidden rounded-xl border ${dark ? 'border-slate-800 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}>
                <img src={this.mediaUrl} alt={item.originalName} className="max-h-40 w-full object-contain" />
              </div>
            ) : null}

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {this.facts.map(([label, value]) => this.renderFact(label, value))}
            </div>

            <div className="flex flex-col gap-3 pt-6 sm:flex-row">
              <Button variant={ButtonVariant.GHOST} className="flex-1" onClick={this.onClose} type="button">Close</Button>
              <Button variant={ButtonVariant.PRIMARY} className="flex-1" onClick={this.openFile} type="button">Open file</Button>
            </div>
          </div>
        </div>
      </RootFramework>
    );
  }
}
