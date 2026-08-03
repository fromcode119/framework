import { CoreServices } from '@core/services/core-services';
import type { IThemeFrontendLayoutRegistrarOptions } from '@core/theme/layout/interfaces/theme-frontend-layout-registrar-options.interface';
import type { IThemeFrontendLayoutRegistration } from '@core/theme/layout/interfaces/theme-frontend-layout-registration.interface';

export abstract class ThemeFrontendLayoutRegistrar {
  constructor(private readonly options: IThemeFrontendLayoutRegistrarOptions) {}

  get serviceName(): string {
    return 'ThemeFrontendLayoutRegistrar';
  }

  registerWithRuntime(): void {
    const registration = this.getRegistration();
    CoreServices.getInstance().defaultDesignRuntimeBridge.unregisterByTheme(registration.themeSlug);
    CoreServices.getInstance().defaultDesignRuntimeBridge.registerThemeOverrides(registration);
  }

  protected buildDisables(): IThemeFrontendLayoutRegistration['disables'] {
    return [];
  }

  protected buildReplacements(): IThemeFrontendLayoutRegistration['replacements'] {
    return [];
  }

  protected getRegistration(): IThemeFrontendLayoutRegistration {
    return {
      themeSlug: this.options.themeSlug,
      disables: this.buildDisables(),
      replacements: this.buildReplacements(),
    };
  }
}