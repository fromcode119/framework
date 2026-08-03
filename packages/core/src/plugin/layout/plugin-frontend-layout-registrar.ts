import { CoreServices } from '@core/services/core-services';
import type { IPluginFrontendLayoutRegistrarOptions } from '@core/plugin/layout/interfaces/plugin-frontend-layout-registrar-options.interface';
import type { IPluginFrontendLayoutRegistration } from '@core/plugin/layout/interfaces/plugin-frontend-layout-registration.interface';

export abstract class PluginFrontendLayoutRegistrar {
  constructor(private readonly options: IPluginFrontendLayoutRegistrarOptions) {}

  get serviceName(): string {
    return 'PluginFrontendLayoutRegistrar';
  }

  registerWithRuntime(): void {
    const registration = this.getRegistration();
    CoreServices.getInstance().defaultDesignRuntimeBridge.unregisterByPlugin(
      registration.namespace,
      registration.pluginSlug,
    );
    CoreServices.getInstance().defaultDesignRuntimeBridge.registerPluginDefaults(registration);
  }

  protected abstract buildPageLayouts(): IPluginFrontendLayoutRegistration['layouts'];

  protected getRegistration(): IPluginFrontendLayoutRegistration {
    return {
      namespace: this.options.namespace,
      pluginSlug: this.options.pluginSlug,
      layouts: this.buildPageLayouts(),
    };
  }
}