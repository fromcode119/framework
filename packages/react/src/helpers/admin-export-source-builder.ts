import type { IRuntimeBridgeInstallArgs } from '@react/interfaces/runtime-bridge-install-args.interface';
import { RuntimeRegistryAccess } from '@fromcode119/core/client';

export class AdminExportSourceBuilder {
  static build(args: IRuntimeBridgeInstallArgs, runtimeRegistry: Record<string, any>): string {
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
      `(${RuntimeRegistryAccess.accessorExpr(args.RuntimeConstants.MODULE_NAMES.ADMIN_COMPONENTS)} || ` +
      `${RuntimeRegistryAccess.accessorExpr(args.RuntimeConstants.MODULE_NAMES.ADMIN)})`;
    return (
      adminExportKeys
        .map((key) => `export const ${key} = ${adminModuleAccessor} ? ${adminModuleAccessor}.${key} : undefined;`)
        .join('\n') + `\nexport default ${adminModuleAccessor};`
    );
  }
}
