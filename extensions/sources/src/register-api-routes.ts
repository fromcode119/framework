import type { PluginContext } from '@fromcode119/sdk';
import type { BuildService } from '@plugin/src/services/build-service';
import { BuildRouter } from '@plugin/src/routers/build-router';

/**
 * Thin route-mounting wrapper for the Sources router.
 * Constructor assembly lives in SourcesBootstrap.
 */
export class BuildApiRegistrar {
  static register(context: PluginContext, buildService: BuildService): void {
    // The version comes from the framework's own plugin record — never a literal. The probe used to
    // report a hardcoded '1.0.0' for a plugin shipping 0.1.x.
    const router = new BuildRouter(buildService, context.auth.platformGuard(), context.plugin.version);
    context.api.use('/', router.router);
  }
}
