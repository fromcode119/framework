import { CoreServices } from '../../services/core-services';
import type {
  PluginFrontendDefaultDesignRegistrarOptions,
  PluginFrontendDefaultDesignRegistration,
} from './plugin-frontend-default-design-registrar.interfaces';

export abstract class PluginFrontendDefaultDesignRegistrar {
  constructor(private readonly options: PluginFrontendDefaultDesignRegistrarOptions) {}

  get serviceName(): string {
    return 'PluginFrontendDefaultDesignRegistrar';
  }

  registerWithRuntime(): void {
    const registration = this.getRegistration();
    CoreServices.getInstance().defaultDesignRuntimeBridge.unregisterByPlugin(
      registration.namespace,
      registration.pluginSlug,
    );
    CoreServices.getInstance().defaultDesignRuntimeBridge.registerPluginDefaults(registration);
  }

  protected abstract buildPageDesigns(): PluginFrontendDefaultDesignRegistration['designs'];

  protected getRegistration(): PluginFrontendDefaultDesignRegistration {
    return {
      namespace: this.options.namespace,
      pluginSlug: this.options.pluginSlug,
      designs: this.buildPageDesigns(),
    };
  }
}