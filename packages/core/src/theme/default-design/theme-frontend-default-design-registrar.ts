import { CoreServices } from '../../services/core-services';
import type {
  ThemeFrontendDefaultDesignRegistrarOptions,
  ThemeFrontendDefaultDesignRegistration,
} from './theme-frontend-default-design-registrar.interfaces';

export abstract class ThemeFrontendDefaultDesignRegistrar {
  constructor(private readonly options: ThemeFrontendDefaultDesignRegistrarOptions) {}

  get serviceName(): string {
    return 'ThemeFrontendDefaultDesignRegistrar';
  }

  registerWithRuntime(): void {
    const registration = this.getRegistration();
    CoreServices.getInstance().defaultDesignRuntimeBridge.unregisterByTheme(registration.themeSlug);
    CoreServices.getInstance().defaultDesignRuntimeBridge.registerThemeOverrides(registration);
  }

  protected buildDisables(): ThemeFrontendDefaultDesignRegistration['disables'] {
    return [];
  }

  protected buildReplacements(): ThemeFrontendDefaultDesignRegistration['replacements'] {
    return [];
  }

  protected getRegistration(): ThemeFrontendDefaultDesignRegistration {
    return {
      themeSlug: this.options.themeSlug,
      disables: this.buildDisables(),
      replacements: this.buildReplacements(),
    };
  }
}