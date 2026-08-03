import { Enum } from '@fromcode119/reactor';

/** PluginDefaultPageContractDependency — one of the 7 states this contract stage can be in. */
export class PluginDefaultPageContractDependency extends Enum {
  static readonly AUDIT = new PluginDefaultPageContractDependency('audit');
  static readonly EMAIL = new PluginDefaultPageContractDependency('email');
  static readonly NAVIGATION = new PluginDefaultPageContractDependency('navigation');
  static readonly PREVIEW = new PluginDefaultPageContractDependency('preview');
  static readonly SEARCH = new PluginDefaultPageContractDependency('search');
  static readonly SETTINGS = new PluginDefaultPageContractDependency('settings');
  static readonly SITEMAP = new PluginDefaultPageContractDependency('sitemap');

  private constructor(value: string) {
    super(value);
  }

  /**
   * Resolve a raw manifest string to a member, or `undefined` when it names no known dependency.
   * Unknown names must be DROPPED, not defaulted — silently turning a typo into a real dependency
   * is exactly what the previous `as` cast did.
   */
  static resolve(value: unknown): PluginDefaultPageContractDependency | undefined {
    if (value instanceof PluginDefaultPageContractDependency) return value;
    return PluginDefaultPageContractDependency.fromValue(String(value ?? '').trim()) as PluginDefaultPageContractDependency | undefined;
  }
}
