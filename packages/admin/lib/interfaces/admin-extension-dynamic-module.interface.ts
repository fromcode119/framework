import type { IAdminExtensionModule } from '@/lib/interfaces/admin-extension-module.interface';

/**
 * The shape a dynamically imported admin-extension module can arrive in.
 *
 * An `interface` extending the module contract rather than a `type` intersection: the extension is
 * loaded from a plugin bundle, which may expose `registerAdminExtension` at the top level or behind a
 * `default` interop wrapper depending on how it was built.
 */
export interface IAdminExtensionDynamicModule extends IAdminExtensionModule {
  default?: IAdminExtensionModule;
}
