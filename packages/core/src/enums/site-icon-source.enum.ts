import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * Where the icon a site serves at `/favicon.ico` and `/apple-touch-icon.png` comes from.
 *
 *   - `SETTING`  — the file picked in Settings → General → Site icon
 *   - `THEME`    — a file the active theme ships in its `ui/` (`favicon.ico`, `apple-touch-icon.png`, …)
 *   - `PLATFORM` — neither: the storefront serves the platform's own mark
 *
 * Crosses the `/system/frontend` payload as `.value`; read it back with `resolve`.
 */
export class SiteIconSource extends Enum {
  static readonly SETTING = new SiteIconSource('setting');
  static readonly THEME = new SiteIconSource('theme');
  static readonly PLATFORM = new SiteIconSource('platform');

  private constructor(value: string) {
    super(value);
  }

  /** An unknown or absent value reads as PLATFORM — the answer that names no file. */
  static resolve(value: unknown): SiteIconSource {
    if (value instanceof SiteIconSource) return value;
    const found = SiteIconSource.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as SiteIconSource | undefined) ?? SiteIconSource.PLATFORM;
  }
}
