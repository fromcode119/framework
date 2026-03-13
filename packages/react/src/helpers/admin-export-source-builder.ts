import type { RuntimeBridgeInstallArgs } from '../context-runtime-bridge.interfaces';

export class AdminExportSourceBuilder {
  static build(args: RuntimeBridgeInstallArgs, runtimeRegistry: Record<string, any>): string {
    const adminModule =
      runtimeRegistry[args.RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS] ||
      runtimeRegistry[args.RuntimeConstants.MODULE_NAMES.ADMIN] ||
      {};
    const adminExportKeys = Array.from(
      new Set<string>([
        ...args.RuntimeConstants.ADMIN_RUNTIME_EXPORT_KEYS,
        ...Object.keys(adminModule),
      ]),
    ).filter((key) => {
      if (!key || key === 'default' || key === '__esModule') return false;
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return false;
      return true;
    });
    const adminModuleAccessor =
      `window.${args.RuntimeConstants.GLOBALS.MODULES} && ` +
      `(window.${args.RuntimeConstants.GLOBALS.MODULES}['${args.RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS}'] || ` +
      `window.${args.RuntimeConstants.GLOBALS.MODULES}['${args.RuntimeConstants.MODULE_NAMES.ADMIN}'])`;
    return (
      adminExportKeys
        .map((key) => `export const ${key} = ${adminModuleAccessor} ? ${adminModuleAccessor}.${key} : undefined;`)
        .join('\n') + `\nexport default ${adminModuleAccessor};`
    );
  }
}
