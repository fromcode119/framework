/**
 * The site an admin page was opened for, sent with every write it makes.
 *
 * One browser session holds ONE active site, shared by every tab. Switching site in one tab moves the
 * session — and a page still open in another tab, loaded for the previous site, then saved ITS values
 * into the NEW site. A Localization page opened on an English-only scope rewrote a Bulgarian site to
 * English that way. The header lets the api refuse a write whose page belongs to another site.
 *
 * It only ever NARROWS: the session still decides which site a request acts in, so a forged value
 * can cause a refusal and nothing else.
 */
export class AdminSiteHeaderConstants {
  static readonly NAME = 'X-Framework-Site';
  /** The value for a page opened in the platform scope (no site selected). */
  static readonly PLATFORM = '@platform';
}
