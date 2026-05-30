import { CoreServices } from '../../services/core-services';
import type {
  ThemeFrontendLayoutRegistrarOptions,
  ThemeFrontendLayoutRegistration,
} from './theme-frontend-layout-registrar.interfaces';

export abstract class ThemeFrontendLayoutRegistrar {
  constructor(private readonly options: ThemeFrontendLayoutRegistrarOptions) {}

  get serviceName(): string {
    return 'ThemeFrontendLayoutRegistrar';
  }

  registerWithRuntime(): void {
    const registration = this.getRegistration();
    CoreServices.getInstance().defaultDesignRuntimeBridge.unregisterByTheme(registration.themeSlug);
    CoreServices.getInstance().defaultDesignRuntimeBridge.registerThemeOverrides(registration);
  }

  protected buildDisables(): ThemeFrontendLayoutRegistration['disables'] {
    return [];
  }

  protected buildReplacements(): ThemeFrontendLayoutRegistration['replacements'] {
    return [];
  }

  protected getRegistration(): ThemeFrontendLayoutRegistration {
    return {
      themeSlug: this.options.themeSlug,
      disables: this.buildDisables(),
      replacements: this.buildReplacements(),
    };
  }
}