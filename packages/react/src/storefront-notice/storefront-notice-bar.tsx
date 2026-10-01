import type { ReactNode } from 'react';
import { bound, state } from '@fromcode119/react-class-components';
import { StorefrontNoticeClient, StorefrontNoticeDisplay, StorefrontNoticeTone } from '@fromcode119/core/client';
import type { IStorefrontNotice } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { StorefrontNoticeTranslations } from '@react/storefront-notice/storefront-notice-translations';

/**
 * The framework's one-time notice over the page a redirect lands on (`?fc_notice=` — minted by
 * `context.ui.noticeUrl`). Framework-owned because any plugin that sends someone back to the site from
 * an email needs it, and two copies of a banner are two places for it to differ.
 *
 * Renders nothing on the server and on the first browser render, so the hydrated tree matches; it shows
 * only what the api confirms the token says, then takes the parameter out of the address bar so a reload
 * or a shared link does not show it again.
 */
export class StorefrontNoticeBar extends PluginComponent {
  private static readonly translations = StorefrontNoticeTranslations.register();

  @state notice: IStorefrontNotice | null = null;
  private mounted = false;

  componentDidMount(): void {
    this.mounted = true;
    const token = StorefrontNoticeClient.readTokenFromWindow();
    if (!token) return;
    void this.load(token);
  }

  componentWillUnmount(): void {
    this.mounted = false;
  }

  private async load(token: string): Promise<void> {
    const notice = await new StorefrontNoticeClient(this.api).resolve(token, StorefrontNoticeDisplay.BAR);
    StorefrontNoticeClient.clearFromWindow();
    if (this.mounted && notice) this.setState({ notice });
  }

  @bound
  onClose(): void {
    this.setState({ notice: null });
  }

  private static mark(tone: StorefrontNoticeTone): ReactNode {
    const path = tone === StorefrontNoticeTone.SUCCESS ? <path d="m5 12 4.5 4.5L19 7" /> : <path d="M12 7.5v5m0 3.5v.5" />;
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {path}
      </svg>
    );
  }

  render(): ReactNode {
    const notice = this.notice;
    if (!notice) return null;
    const tone = StorefrontNoticeTone.of(notice.tone);
    return (
      <div className={`fc-notice fc-notice--${tone.value}`} role={tone === StorefrontNoticeTone.ERROR ? 'alert' : 'status'} aria-live="polite">
        <span className="fc-notice__mark">{StorefrontNoticeBar.mark(tone)}</span>
        <div className="fc-notice__text">
          <p className="fc-notice__title">{notice.title}</p>
          {notice.body ? <p className="fc-notice__body">{notice.body}</p> : null}
        </div>
        <button type="button" className="fc-notice__close" aria-label={this.t('storefrontNotice.close', {}, 'Close')} onClick={this.onClose}>×</button>
      </div>
    );
  }
}
