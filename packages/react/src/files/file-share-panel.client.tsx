import type { ReactNode } from 'react';
import { state, bound } from '@fromcode119/react-class-components';
import { ApiVersionUtils, ApplicationUrlUtils, FileRoutePaths } from '@fromcode119/core/client';
import { PluginComponent } from '@react/view/plugin-component.client';
import { FrameworkTranslations } from '@react/i18n/framework-translations';
import { FileShareTranslations } from '@react/files/file-share-translations';

/**
 * What a recipient sees when they open a share link.
 *
 * The framework's own rendering, complete on its own: this page is reached from an email by someone who
 * may have no account and no relationship to the site's theme, so it cannot require a themed content page
 * to look or read correctly. A theme may wrap it; it is never needed to make it work.
 *
 * The token is read from the URL at call time, not on construction: this renders on the server first,
 * where `window` does not exist, and a field initialised then would be frozen empty into the markup.
 */
export class FileSharePanel extends PluginComponent {
  @state private loading = true;
  @state private title = '';
  @state private message = '';
  @state private files: Array<{ id: number; name: string; size: number }> = [];
  @state private downloadsRemaining: number | null = null;
  /**
   * One error string for every refusal. The endpoint deliberately does not distinguish expired from
   * revoked from unknown, and neither does this — reflecting a difference back would leak the thing
   * the API took care not to say.
   */
  @state private error = '';

  /**
   * Copy that does not depend on the theme, a plugin, or the context provider.
   *
   * `PluginComponent.t` reads from the runtime context. On this route there may be none: when a theme
   * seeds no content page for `/files`, the framework's fallback panel mounts outside the provider and every
   * key painted as its own name. The context translator still wins where it exists, so a theme can
   * override; the framework pack is the floor.
   */
  private text(key: string, vars?: Record<string, unknown>): string {
    const fromContext = this.t(key, vars as any);
    if (fromContext && fromContext !== key) return fromContext;
    return FrameworkTranslations.t(key, vars);
  }

  private get token(): string {
    if (typeof window === 'undefined') return '';
    const parts = window.location.pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts[parts.indexOf('files') + 1] || '');
  }

  private get apiBase(): string {
    return ApplicationUrlUtils.inferBrowserBaseUrl('api');
  }

  /** The API is mounted at `/api/v1`; the version segment alone resolves to a path that 404s. */
  private get sharePath(): string {
    return ApplicationUrlUtils.joinApiPath(this.apiBase, `${ApiVersionUtils.prefix()}${FileRoutePaths.token(this.token)}`);
  }

  private downloadPath(mediaId: number): string {
    return ApplicationUrlUtils.joinApiPath(this.apiBase, `${ApiVersionUtils.prefix()}${FileRoutePaths.tokenDownload(this.token, mediaId)}`);
  }

  async componentDidMount(): Promise<void> {
    FileShareTranslations.register();
    await this.load();
  }

  @bound
  private async load(): Promise<void> {
    this.loading = true;
    try {
      // credentials:'include' so a grant that requires a signed-in account can see the session; the
      // token alone still identifies the grant.
      const response = await fetch(this.sharePath, { credentials: 'include' });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        this.error = this.text('files.share.unavailable');
        this.files = [];
        return;
      }

      this.title = String(body?.title || '');
      this.message = String(body?.message || '');
      this.files = Array.isArray(body?.files) ? body.files : [];
      this.downloadsRemaining = body?.downloadsRemaining ?? null;
      this.error = '';
    } catch {
      this.error = this.text('files.share.loadFailed');
    } finally {
      this.loading = false;
    }
  }

  /** Bytes, rendered for a human. Returns nothing for an unknown size rather than inventing one. */
  private formatSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  render(): ReactNode {
    // Registered in render as well: at mount the pack is set synchronously, but a server-rendered pass
    // reaches render without ever running componentDidMount.
    FileShareTranslations.register();

    if (this.loading) {
      return (
        <div className="fc-file-share">
          <div className="fc-file-share__card fc-file-share__card--muted">{this.text('files.share.loading')}</div>
        </div>
      );
    }

    if (this.error) {
      return (
        <div className="fc-file-share">
          <div className="fc-file-share__card fc-file-share__card--muted">
            <p className="fc-file-share__error">{this.error}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="fc-file-share">
        <div className="fc-file-share__card">
          <header className="fc-file-share__header">
            <p className="fc-file-share__eyebrow">{this.text('files.share.title')}</p>
            <h1 className="fc-file-share__title">{this.title}</h1>
            {this.message ? <p className="fc-file-share__message">{this.message}</p> : null}
          </header>

          <ul className="fc-file-share__list">
            {this.files.map((file) => (
              <li key={file.id} className="fc-file-share__item">
                <span className="fc-file-share__name">{file.name}</span>
                <span className="fc-file-share__meta">
                  {this.formatSize(file.size) ? (
                    <span className="fc-file-share__size">{this.formatSize(file.size)}</span>
                  ) : null}
                  <a className="fc-file-share__button" href={this.downloadPath(file.id)} rel="noopener">
                    {this.text('files.share.download')}
                  </a>
                </span>
              </li>
            ))}
          </ul>

          <footer className="fc-file-share__footer">
            {this.downloadsRemaining !== null ? (
              <p className="fc-file-share__quota">{this.text('files.share.remaining', { count: this.downloadsRemaining })}</p>
            ) : null}
            <p className="fc-file-share__note">{this.text('files.share.privateNote')}</p>
          </footer>
        </div>
      </div>
    );
  }
}
