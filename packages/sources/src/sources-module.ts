import * as path from 'path';
import type { RequestHandler } from 'express';
import { Logger } from '@fromcode119/core';
import { BuildService } from '@sources/packaging/build-service';
import { BuildSourceSecretService } from '@sources/sources/build-source-secret-service';
import { BuildSourceService } from '@sources/sources/build-source-service';
import { BuildSourceType } from '@sources/sources/enums/build-source-type.enum';
import { CatalogContributionService } from '@sources/catalog/catalog-contribution-service';
import { SourceProviders } from '@sources/providers/source-providers';
import { LegacyWorkspaceAdoption } from '@sources/settings/legacy-workspace-adoption';
import { PackageBuilder } from '@sources/packaging/package-builder';
import { SourcesEvents } from '@sources/events/sources-events';
import { SourcesRouter } from '@sources/http/sources-router';
import { BuildPackageArtifactHook } from '@sources/events/hooks/build-package-artifact-hook';
import { BuildPackageDownloadHook } from '@sources/events/hooks/build-package-download-hook';
import { BuildSourceDeleteHook } from '@sources/events/hooks/build-source-delete-hook';
import { BuildSourceListHook } from '@sources/events/hooks/build-source-list-hook';
import { BuildSourceSyncHook } from '@sources/events/hooks/build-source-sync-hook';
import { BuildTriggerHook } from '@sources/events/hooks/build-trigger-hook';
import { BuildUpdatesCheckHook } from '@sources/events/hooks/build-updates-check-hook';
import type { ISourcesModuleInput } from '@sources/interfaces/sources-module-input.interface';

/**
 * Wires Sources into the running framework.
 *
 * This is what a plugin's `onInit` used to be, minus the plugin. There is no manifest to read, no
 * capability to request, no integrity checksum over the framework's own code, and no sandbox between
 * these services and the framework they are part of — every dependency below is passed in by the
 * caller that already owns it.
 *
 * The one thing it keeps from the plugin era is the HOOK surface. Those events are a real contract:
 * `plugin-manager` calls them, and a plugin is exactly the kind of thing that should reach Sources
 * through a published event rather than an import.
 */
export class SourcesModule {
  private static readonly DEFAULT_SCHEDULE = '*/15 * * * *';
  private static readonly logger = new Logger({ namespace: 'sources' });

  /**
   * Builds the service graph and returns the router for the caller to mount.
   *
   * Registration of the hooks, the timer and the catalogue contribution happens here rather than in
   * the caller, because they are this module's business and a caller that had to remember them is a
   * caller that will one day forget one.
   */
  static install(input: ISourcesModuleInput): SourcesRouter {
    const workspaceRoot = SourcesModule.resolveWorkspaceRoot(input);
    SourcesModule.logger.info(`Build workspace: ${workspaceRoot}`);

    const buildSourceService = new BuildSourceService(input.db, new BuildSourceSecretService(input.secrets));
    const packageBuilder = new PackageBuilder(
      path.join(workspaceRoot, 'plugins'),
      path.join(workspaceRoot, 'themes'),
      path.join(workspaceRoot, 'core'),
    );
    const sourceDir = path.join(workspaceRoot, 'source');
    const buildService = new BuildService(
      input.db,
      (key) => SourceProviders.find(key, sourceDir),
      packageBuilder,
      buildSourceService,
      (event) => { void input.hooks.emit(SourcesEvents.PACKAGE_BUILT, event); },
      input.installer,
    );

    SourcesModule.registerHooks(input, buildService);
    SourcesModule.registerCatalogue(input, buildSourceService, buildService);
    void SourcesModule.registerTimer(input, buildService);

    return new SourcesRouter(buildService, input.adminGuard);
  }

  /**
   * The agent's OWN workspace — never the directory the platform runs from.
   *
   * `process.cwd()` in the api container is `/app`, which the app user cannot write, and `/app/plugins`
   * and `/app/themes` are the LIVE mounted repositories: pointing build output there would write over
   * the sources it packages.
   */
  private static resolveWorkspaceRoot(input: ISourcesModuleInput): string {
    if (input.workspaceRoot) return path.resolve(input.workspaceRoot);

    const root = path.resolve(input.projectRoot, 'data', 'sources');
    LegacyWorkspaceAdoption.adopt(root, (message) => SourcesModule.logger.info(message));
    return root;
  }

  private static registerHooks(input: ISourcesModuleInput, buildService: BuildService): void {
    BuildPackageArtifactHook.register(input.hooks, buildService);
    BuildPackageDownloadHook.register(input.hooks, buildService);
    BuildSourceDeleteHook.register(input.hooks, buildService);
    BuildSourceListHook.register(input.hooks, buildService);
    BuildSourceSyncHook.register(input.hooks, buildService);
    BuildTriggerHook.register(input.hooks, buildService);
    BuildUpdatesCheckHook.register(input.hooks, buildService);
  }

  /**
   * Offers every built version to the admin's catalogue.
   *
   * This is what makes a new version visible on the Plugins screen without anyone opening Sources:
   * the counter, the badge and the update action all read that catalogue already.
   */
  private static registerCatalogue(
    input: ISourcesModuleInput,
    buildSourceService: BuildSourceService,
    buildService: BuildService,
  ): void {
    if (!input.catalog) return;

    input.catalog.contribute(
      async () => CatalogContributionService.entriesFrom(await buildSourceService.listSanitizedSources()),
      // Where the offered file actually is. An offer from here is an archive this installation built,
      // and its catalogue row carries only a filename — without this an installer resolved that name
      // against the remote marketplace and fetched a package that had never been published there.
      async (slug: string, kind: string) => buildService.resolvePackageFilePath(slug, BuildSourceType.resolve(kind)),
    );
    SourcesModule.logger.info('Offering built versions to the admin catalogue.');
  }

  /**
   * The timer behind each source's "Build automatically".
   *
   * Registered unconditionally: it was once gated behind an environment variable no admin screen
   * mentioned and nothing set, so the toggle could never fire a build on any deployment.
   */
  private static async registerTimer(input: ISourcesModuleInput, buildService: BuildService): Promise<void> {
    if (!input.scheduler) return;

    try {
      await input.scheduler.register('sources:auto-build', SourcesModule.DEFAULT_SCHEDULE, async () => {
        await buildService.checkAndBuildUpdates();
      });
      SourcesModule.logger.info(`Auto-build scheduled (${SourcesModule.DEFAULT_SCHEDULE}).`);
    } catch (error: unknown) {
      SourcesModule.logger.warn(`Could not schedule auto-build: ${String((error as Error)?.message ?? error)}`);
    }
  }
}
