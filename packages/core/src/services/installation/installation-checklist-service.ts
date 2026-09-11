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
      activeThemeName: () => string;
      countSites: () => Promise<number>;
      countPlugins: () => number;
      countUsers: () => Promise<number>;
      readMeta: (key: string) => Promise<string>;
      storefrontUrl: () => string;
    },
  ) {}

  async read(): Promise<Record<string, unknown>> {
    const activeTheme = this.deps.activeThemeName();
    const storefront = this.deps.storefrontUrl();
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
      /**
       * A theme is what makes this installation serve anything, so an install with no ACTIVE theme
       * is one nobody has started using — whatever else happens to be installed.
       *
       * It used to also require zero plugins, which broke the moment the platform installed one of
       * its own: a single inactive plugin made a completely empty installation claim it was in use,
       * and the setup steps vanished from the operator's first screen.
       */
      /**
       * No ACTIVE theme AND nothing the operator installed themselves. The theme alone was too
       * eager — a working installation whose theme is momentarily deactivated is not a new one —
       * and counting plugins alone broke the moment the framework bundled one of its own.
       */
      isFresh: !activeTheme && plugins === 0,
      counts: { themes, sites, plugins, users },
      /**
       * ONE site unless tenant rows exist — `TenantMode` enables multi-tenancy only when
       * `_system_tenants` is non-empty, and a single-site deployment serves the hosts in its
       * environment with no site record at all. Telling an operator to "create your first site"
       * would push them into multi-tenancy they never asked for.
       */
      mode: sites > 0 ? 'multi-site' : 'single-site',
      storefront,
      steps: [
        {
          key: 'theme',
          title: activeTheme ? `Theme: ${activeTheme}` : (themes > 0 ? 'Activate a theme' : 'Install a theme'),
          detail: themes > 0
            ? 'Installed but not activated — until one is active the storefront serves an empty document.'
            : 'A theme renders every page a visitor sees. Without one, the storefront serves an empty document.',
          done: Boolean(activeTheme),
          actionLabel: themes > 0 ? 'Activate' : 'Browse themes',
          actionPath: AppPathConstants.ADMIN.THEMES.ROOT,
        },
        {
          key: 'plugins',
          title: plugins > 0 ? `${plugins} plugins installed` : 'Install the plugins this platform needs',
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
          /**
           * The type MUST be named. The integrations screen falls back to the alphabetically first
           * integration when the query says nothing, so a link to the bare path opened `?type=ai` —
           * the AI provider — from a row about email.
           */
          actionPath: AppPathConstants.ADMIN.SETTINGS.INTEGRATIONS_BY_TYPE('email'),
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
          // Timezone is a General setting; Localization owns languages and has no timezone field.
          actionPath: AppPathConstants.ADMIN.SETTINGS.GENERAL,
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
