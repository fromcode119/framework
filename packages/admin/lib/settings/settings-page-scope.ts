import { PlatformSettingLocks } from '@/lib/settings/platform-setting-locks';

/**
 * How ONE settings page's own key set fares in the current scope.
 *
 * `PlatformSettingLocks` answers per key. That was enough for Settings → General, which is the only
 * page mixing platform and site keys — it always has something to show, so filtering per key was the
 * whole job. Every other settings page is 100% SITE keys, and per-key filtering there produces an
 * EMPTY form: `Security` renders twenty-three controls in the platform scope, each of which the API
 * refuses, and a save loses all twenty-three edits at once. A page with nothing to show in this scope
 * must say so instead of rendering a form that cannot act.
 *
 * So the page declares its keys once and asks three things: what to show, what a save may send, and
 * whether there is anything here at all.
 */
export class SettingsPageScope {
  constructor(
    private readonly locks: PlatformSettingLocks,
    private readonly keys: readonly string[],
  ) {}

  /** Does this key belong on the screen in the current scope? */
  shows(key: string): boolean {
    return this.locks.shown(key);
  }

  get visibleKeys(): string[] {
    return this.keys.filter((key) => this.locks.shown(key));
  }

  get hiddenKeys(): string[] {
    return this.keys.filter((key) => !this.locks.shown(key));
  }

  /**
   * Is there nothing on this page for the current scope?
   *
   * Only ever true in tenant mode — a single-tenant deployment shows every key, so there is no scope
   * to be empty in. A page in this state renders the scope panel instead of its form.
   */
  get isEmpty(): boolean {
    return this.visibleKeys.length === 0 && this.hiddenKeys.length > 0;
  }

  /**
   * Where do the keys this page is NOT showing live?
   *
   * `'site'` — they are per-site settings and no site is selected. `'platform'` — they are the
   * platform's and this screen is inside a site. `null` — nothing is hidden.
   */
  get hiddenBelongTo(): 'site' | 'platform' | null {
    const hidden = this.hiddenKeys;
    if (hidden.length === 0) return null;
    return this.locks.isSiteScope() ? 'platform' : 'site';
  }

  /**
   * What a save may actually send: shown AND writable.
   *
   * Not the same test. A platform admin inside a site may WRITE a platform key — the API routes it to
   * the platform row — but that control lives in the platform scope, so sending this screen's copy of
   * its value would overwrite whatever someone changed since the page loaded.
   */
  sendable<T extends Record<string, unknown>>(payload: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(payload).filter(([key]) => this.locks.shown(key) && this.locks.writable(key)),
    ) as Partial<T>;
  }

  /**
   * One line naming where the hidden half lives, so hiding never makes a setting undiscoverable.
   *
   * `describeHidden` lets a page name its own fields ("name, domains, timezone") where that helps;
   * without it the sentence still says which scope owns them, which is the part that cannot be
   * guessed from the screen. Empty when nothing is hidden.
   */
  notice(options: { canManagePlatform: boolean; describeHidden?: string }): string {
    const belongsTo = this.hiddenBelongTo;
    if (!belongsTo) return '';
    const what = options.describeHidden ? `Site settings (${options.describeHidden})` : 'These settings';

    if (belongsTo === 'site') {
      return `${what} are set inside each site — choose one from the site menu.`;
    }
    const platformWhat = options.describeHidden ? `Platform settings (${options.describeHidden})` : 'Platform settings on this page';
    return options.canManagePlatform
      ? `${platformWhat} live in Platform scope.`
      : `${platformWhat} live in Platform scope and are managed by a platform administrator.`;
  }
}
