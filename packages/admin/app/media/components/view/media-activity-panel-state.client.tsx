import type { ReactNode } from 'react';
import { state } from '@fromcode119/react-class-components';
import { AdminComponent } from '@/components/view/admin-component.client';
import { AdminPathUtils } from '@/lib/admin-path';
import { TimezoneUtils } from '@/lib/timezone';

/**
 * Which window of media activity is being looked at, and what came back for it.
 *
 * The base of this panel's chain — the fetches, then the sections, then the frame.
 *
 * The window is EITHER a rolling number of days OR an explicit from/to pair; `rangeMode` says which,
 * so a custom range is never silently reinterpreted as "the last N days".
 */
export abstract class MediaActivityPanelState extends AdminComponent {
  @state protected data: any = null;
  @state protected loading = true;
  @state protected days = 30;
  /** 'preset' follows `days`; 'custom' follows the two picked instants below. */
  @state protected rangeMode: 'preset' | 'custom' = 'preset';
  /** Full instants as the DateTimePicker emits them; turned into calendar days only when querying. */
  @state protected fromIso = '';
  @state protected toIso = '';
  @state protected loadingMore = false;
  /** When set, everything on the screen is about this one share. Comes from `?share=` in the URL. */
  @state protected shareId: number | null = null;

  protected mounted = false;

  /** The coherent custom window, or null while it is half-picked. */
  protected customWindow(): { from: string; to: string } | null {
    if (this.rangeMode !== 'custom') return null;
    const from = MediaActivityPanelState.pickedDay(this.fromIso);
    const to = MediaActivityPanelState.pickedDay(this.toIso);
    return from && to && to >= from ? { from, to } : null;
  }

  protected query(): { days?: number; from?: string; to?: string; share?: number } {
    const window = this.customWindow();
    return {
      ...(window ?? { days: this.days }),
      ...(this.shareId ? { share: this.shareId } : {}),
    };
  }

  protected formatWhen(value: unknown): string {
    if (!value) return '';
    const raw = String(value);
    const date = new Date(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
  }

  /**
   * The picker's date-only mode emits the literal calendar day (`YYYY-MM-DD`); pass it through
   * unchanged. Re-parsing it as an instant and re-localizing (the previous workaround for the
   * picker's old UTC-instant emit) would shift the day again in negative-offset browsers.
   */
  protected static pickedDay(iso: string | null): string {
    const day = String(iso || '').split('T')[0]!;
    return TimezoneUtils.isDateOnlyValue(day) ? day : '';
  }

  /**
   * A share's name, as a LINK to that share in the Shared view — every mention of a share on this
   * screen is a way back to its controls, so "who is this about" is one click from "do something".
   */
  protected shareLink(shareId: unknown, title: string): ReactNode {
    if (!shareId) return <span>{title || 'Untitled share'}</span>;
    return (
      <a
        className="hover:underline text-indigo-500"
        href={AdminPathUtils.toAdminPath(`/media/shared?share=${Number(shareId)}`)}
      >
        {title || 'Untitled share'}
      </a>
    );
  }
}
