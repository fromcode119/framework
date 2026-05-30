import { CoreServices } from '../../services/core-services';
import type {
  PluginFrontendLayoutRegistrarOptions,
  PluginFrontendLayoutRegistration,
} from './plugin-frontend-layout-registrar.interfaces';

export abstract class PluginFrontendLayoutRegistrar {
  constructor(private readonly options: PluginFrontendLayoutRegistrarOptions) {}

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

  protected abstract buildPageLayouts(): PluginFrontendLayoutRegistration['layouts'];

  protected getRegistration(): PluginFrontendLayoutRegistration {
    return {
      namespace: this.options.namespace,
      pluginSlug: this.options.pluginSlug,
      layouts: this.buildPageLayouts(),
    };
  }
}