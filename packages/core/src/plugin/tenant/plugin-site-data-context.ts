import type { PluginContext } from '@core/plugin/plugin-context';

/**
 * The same plugin context, with everything that REGISTERS turned off.
 *
 * A plugin's `onInit` does two unrelated jobs in one function: it registers (routes, collections,
 * hooks, schedules — global, exactly once) and it sets up data (defaults, backfills, normalisations —
 * per site). On a multi-site deployment the second half silently did nothing at all: boot has no
 * site, so every tenant-scoped read was skipped and every write refused. Seven plugins had the same
 * bug, which is the tell that it was never theirs to solve — asking each author to remember a
 * tenancy call is the scaffolding this framework is not supposed to have.
 *
 * So the framework runs `onInit` again, once per site, against this context. The data half runs for
 * each site, in that site's scope; the registration half finds every registration method inert and
 * does nothing a second time. Plugin code does not change, and a plugin written with no idea that
 * multi-site exists behaves correctly on one.
 *
 * What stays LIVE is everything that reads or writes: `db`, `meta`, `people`, `media`,
 * `notifications`, `settings.get`. What is inert is only the act of declaring something to the
 * framework — declared once already, by the pass that came before.
 */
export class PluginSiteDataContext {
  /** Registration surfaces, by the path a plugin calls them through. */
  private static readonly INERT: Record<string, string[]> = {
    api: ['use', 'get', 'post', 'put', 'patch', 'delete', 'all', 'registerMiddleware', 'registerGate'],
    collections: ['register'],
    hooks: ['on', 'off'],
    plugins: ['on'],
    scheduler: ['register'],
    settings: ['register'],
    i18n: ['registerTranslations'],
    mcp: ['registerTools'],
    entityRecords: ['register'],
    catalog: ['contribute'],
    migrations: ['run'],
    // Already fans out per site inside the framework; calling it from every site's pass would do the
    // same work once per site per site.
    people: [],
  };

  /**
   * Wraps `context` so registration calls are accepted and ignored.
   *
   * A no-op RETURNS something plausible rather than undefined: plugin code chains on these
   * (`context.api.use(...)`, `await context.scheduler.register(...)`), and a bare undefined would
   * throw inside the plugin rather than in the framework that decided to suppress the call.
   */
  static wrap(context: PluginContext): PluginContext {
    const overrides: Record<string, unknown> = {};

    for (const [surface, methods] of Object.entries(PluginSiteDataContext.INERT)) {
      const original = (context as unknown as Record<string, any>)[surface];
      if (!original) continue;
      overrides[surface] = PluginSiteDataContext.inertSurface(original, methods, surface);
    }

    return new Proxy(context as unknown as Record<string, unknown>, {
      get: (target, prop) => (typeof prop === 'string' && prop in overrides
        ? overrides[prop]
        : (target as Record<string, unknown>)[prop as string]),
    }) as unknown as PluginContext;
  }

  /**
   * One surface with its registration methods replaced.
   *
   * `people` names no methods: its catalog registration already runs per site inside the framework,
   * so the whole surface passes through untouched — the empty list is the statement that this was
   * considered, not an omission.
   */
  private static inertSurface(original: unknown, methods: string[], surface: string): unknown {
    if (methods.length === 0) return original;

    return new Proxy(original as Record<string, unknown>, {
      get: (target, prop) => {
        if (typeof prop === 'string' && methods.includes(prop)) {
          return PluginSiteDataContext.noop(surface, prop);
        }
        const value = (target as Record<string, any>)[prop as string];
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  /** Accepts any arguments, does nothing, and resolves — so `await` and chaining both survive. */
  private static noop(surface: string, method: string): (...args: unknown[]) => Promise<undefined> {
    const inert = async (): Promise<undefined> => undefined;
    Object.defineProperty(inert, 'name', { value: `inert:${surface}.${method}` });
    return inert;
  }
}
