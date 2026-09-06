import type { ComponentType, ReactNode } from 'react';
import { PureReactor, bound, prop } from '@fromcode119/reactor';
import { FrameworkIcons } from '@react/icons/view/framework-icons.client';
import { LucideLazyLoader } from '@react/icons/lucide-lazy-loader';
import type { IRecordsHubItem } from '@react/interfaces/records-hub-item.interface';

/** One row of the records hub: icon, title/status/badges, trailing label + date, open/download action. */
export class RecordsHubItemRow extends PureReactor {
  @prop declare item: IRecordsHubItem;
  @prop declare dark: boolean;
  @prop declare onOpenItem?: (item: IRecordsHubItem) => void;

  /**
   * Resolves a provider-supplied icon name to a component, falling back to
   * FileText for a missing or unknown name. Icons resolve lazily at render time.
   */
  private icon(name?: string): ComponentType<any> {
    const resolved = name && LucideLazyLoader.has(name) ? name : 'FileText';
    return FrameworkIcons.getIcon(resolved);
  }

  // The framework is domain-agnostic: it has NO money concept. It renders the provider's
  // opaque `trailing` label verbatim — the owning plugin decides what it means.
  private trailing(item: IRecordsHubItem): string | null {
    const display = item.trailing == null ? '' : String(item.trailing).trim();
    return display || null;
  }

  private date(value?: string): string {
    if (!value) return '';
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return '';
    return new Date(ms).toISOString().slice(0, 10);
  }

  @bound
  private open(): void {
    this.onOpenItem?.(this.item);
  }

  render(): ReactNode {
    const item = this.item;
    const dark = this.dark;
    const Icon = this.icon(item.icon);
    const trailing = this.trailing(item);
    const date = this.date(item.date);
    const openable = Boolean(item.href || item.downloadUrl);
    const ActionIcon = this.icon(item.downloadUrl ? 'Download' : 'ExternalLink');
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors ${dark ? 'border-slate-800/50 bg-slate-900/30 hover:bg-slate-900/60' : 'border-slate-100 bg-white hover:bg-slate-50'}`}>
        <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${dark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
          <Icon size={16} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={`truncate text-[13px] font-bold tracking-tight ${dark ? 'text-slate-100' : 'text-slate-800'}`}>{item.title}</p>
            {item.status ? (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${dark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
            ) : null}
            {(item.badges || []).map((b) => (
              <span key={b} className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${dark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{b}</span>
            ))}
          </div>
          {item.subtitle ? <p className="truncate text-[11px] font-semibold text-slate-400 mt-0.5">{item.subtitle}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          {trailing ? <p className={`text-[12px] font-bold tabular-nums ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{trailing}</p> : null}
          {date ? <p className="text-[10px] font-bold text-slate-400 tabular-nums">{date}</p> : null}
        </div>
        {openable ? (
          <button type="button" onClick={this.open}
            className={`shrink-0 h-8 w-8 rounded-xl flex items-center justify-center transition-colors ${dark ? 'text-slate-400 hover:bg-slate-800 hover:text-indigo-400' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}
            aria-label={item.downloadUrl ? 'Download' : 'Open'}>
            <ActionIcon size={15} />
          </button>
        ) : null}
      </div>
    );
  }
}
