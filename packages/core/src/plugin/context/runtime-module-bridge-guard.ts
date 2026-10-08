/**
 * What `context.runtime.registerModule` accepts. A bridge is served to every page and can remap
 * module imports for the whole app, so registering one is a platform-wide change (`extensions:manage`), and its name and keys
 * are written into served JavaScript verbatim — unescaped, they were a script-injection point.
 */
export class RuntimeModuleBridgeGuard {
  private static readonly MODULE_NAME = /^[@A-Za-z0-9_./-]+$/;
  private static readonly IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

  static assert(security: { hasCapability(cap: string): boolean; handleViolation(cap: string): void }, name: unknown, keys: unknown): void {
    if (!security.hasCapability('extensions:manage')) security.handleViolation('extensions:manage');
    const list = Array.isArray(keys) ? keys : [];
    if (!RuntimeModuleBridgeGuard.MODULE_NAME.test(String(name)) || !list.every((key) => RuntimeModuleBridgeGuard.IDENTIFIER.test(String(key)))) {
      throw new Error(`runtime.registerModule refused "${String(name)}": names must be module paths and keys identifiers.`);
    }
  }
}
