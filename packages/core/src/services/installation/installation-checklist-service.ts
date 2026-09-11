import { CoercionUtils } from '@core/utils/coercion-utils';
import { AppPathConstants } from '@core/constants/app-path.constants';

/**
 * What this installation has, and what it is still missing.
 *
 * The first screen after setup should answer "what now?", and on a fresh install that answer is not
 * a row of zeros. Every item below is READ, never assumed: a theme exists or it does not, an email
 * provider is configured or nothing can be sent. Nothing is a default and nothing is invented to
 * make the list look full.
 *
 * `isFresh` is deliberately about CONTENT rather than age: an installation with no theme and no
 * plugins is one nobody has started using, whether that happened five minutes ago or last year.
 */
export class InstallationChecklistService {
  constructor(
    private readonly deps: {
      countThemes: () => number;
      countSites: () => Promise<number>;
      countPlugins: () => number;
      countUsers: () => Promise<number>;
      readMeta: (key: string) => Promise<string>;
    },
  ) {}

  async read(): Promise<Record<string, unknown>> {
    const [themes, sites, plugins, users] = await Promise.all([
      Promise.resolve(this.deps.countThemes()),
      this.deps.countSites(),
      Promise.resolve(this.deps.countPlugins()),
      this.deps.countUsers(),
    ]);

    const [emailProvider, timezone, locales] = await Promise.all([
      this.deps.readMeta('integration_email_provider'),
      this.deps.readMeta('timezone'),
      this.deps.readMeta('enabled_locales'),
    ]);

    return {
      isFresh: themes === 0 && plugins === 0,
      counts: { themes, sites, plugins, users },
      steps: [
        {
          key: 'theme',
          title: 'Install a theme',
          detail: 'A theme renders every page a visitor sees. Without one, a site serves an empty document.',
          done: themes > 0,
          actionLabel: 'Browse themes',
          actionPath: AppPathConstants.ADMIN.THEMES.ROOT,
        },
        {
          key: 'site',
          title: 'Create your first site',
          detail: 'A site is a hostname and the content behind it. One installation can hold many.',
          done: sites > 0,
          actionLabel: 'New site',
          actionPath: AppPathConstants.ADMIN.SITES.ROOT,
        },
        {
          key: 'plugins',
          title: 'Install the plugins this platform needs',
          detail: 'Commerce, forms, SEO — each adds its own screens. Install only what this installation will use.',
          done: plugins > 0,
          actionLabel: 'Browse plugins',
          actionPath: AppPathConstants.ADMIN.PLUGINS.ROOT,
        },
      ],
      missing: [
        {
          key: 'email',
          title: 'Email delivery',
          detail: emailProvider ? `Configured · ${emailProvider}` : 'Nothing can be sent — no order mail, no password resets',
          done: Boolean(emailProvider),
          actionLabel: 'Configure',
          actionPath: AppPathConstants.ADMIN.SETTINGS.INTEGRATIONS,
        },
        {
          key: 'locales',
          title: 'Languages',
          detail: InstallationChecklistService.localeSummary(locales),
          done: InstallationChecklistService.parseLocales(locales).length > 1,
          actionLabel: 'Add',
          actionPath: AppPathConstants.ADMIN.SETTINGS.LOCALIZATION,
        },
        {
          key: 'timezone',
          title: 'Timezone',
          detail: timezone || 'Not set — dates render in the server’s own zone',
          done: Boolean(timezone),
          actionLabel: 'Change',
          actionPath: AppPathConstants.ADMIN.SETTINGS.LOCALIZATION,
        },
        {
          key: 'team',
          title: 'Team',
          detail: users > 1 ? `${users} users` : 'You are the only user',
          done: users > 1,
          actionLabel: 'Invite',
          actionPath: AppPathConstants.ADMIN.USERS.ROOT,
        },
      ],
    };
  }

  private static localeSummary(raw: string): string {
    const locales = InstallationChecklistService.parseLocales(raw);
    if (locales.length === 0) return 'Not configured';
    if (locales.length === 1) return `${locales[0]} only`;
    return locales.join(', ');
  }

  /** Stored as JSON by the settings screen and as a comma list by older installs; both are read. */
  private static parseLocales(raw: string): string[] {
    const value = CoercionUtils.toString(raw).trim();
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((entry) => String(entry).trim()).filter(Boolean);
    } catch {
      // Not JSON — fall through to the comma list.
    }
    return value.split(',').map((entry) => entry.trim()).filter(Boolean);
  }
}
