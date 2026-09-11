import type { PluginContext } from '@fromcode119/sdk';
import { CoercionUtils } from '@fromcode119/sdk';
import { ProjectPaths } from '@fromcode119/sdk/server';
import * as path from 'path';
import { BuildsCollection } from '@plugin/src/collections/builds';
import { SourcesSettingsSchema } from '@plugin/settings';
import { GitSyncService } from '@plugin/src/services/git-sync-service';
import { PackageBuilder } from '@plugin/src/services/package-builder';
import { BuildService } from '@plugin/src/services/build-service';
import { SourcesEvents } from '@plugin/src/sources-events';
import { LegacyWorkspaceAdoption } from '@plugin/src/bootstrap/legacy-workspace-adoption';
import { BuildApiRegistrar } from '@plugin/src/register-api-routes';
import { BuildSourceSecretService } from '@plugin/src/services/build-source-secret-service';
import { BuildSourceService } from '@plugin/src/services/build-source-service';
import { BuildPackageArtifactHook } from '@plugin/src/hooks/build-package-artifact-hook';
import { BuildPackageDownloadHook } from '@plugin/src/hooks/build-package-download-hook';
import { BuildSourceDeleteHook } from '@plugin/src/hooks/build-source-delete-hook';
import { BuildSourceListHook } from '@plugin/src/hooks/build-source-list-hook';
import { BuildSourceSyncHook } from '@plugin/src/hooks/build-source-sync-hook';
import { BuildTriggerHook } from '@plugin/src/hooks/build-trigger-hook';
import { BuildUpdatesCheckHook } from '@plugin/src/hooks/build-updates-check-hook';
import { CatalogContributionService } from '@plugin/src/services/catalog-contribution-service';

/**
 * Composes all sources services, mounts API routes, and
 * optionally starts the auto-build polling loop.
 */
export class SourcesBootstrap {
  /**
   * Every fifteen minutes. Frequent enough that a merged change is built while it is still the thing
   * someone is thinking about, rare enough that tracking a dozen repositories is a dozen `ls-remote`
   * calls an hour. `AUTO_BUILD_SCHEDULE` overrides it for a deployment that wants another cadence.
   */
  private static readonly DEFAULT_SCHEDULE = '*/15 * * * *';

  constructor(private readonly context: PluginContext) {}

  /**
   * The configured workspace, or a writable default beside the platform's other data.
   *
   * Deliberately NOT `process.cwd()`: that is the directory the platform itself runs from, and pointing
   * a build agent's output at it means writing over the installed plugins and themes.
   */
  private async resolveWorkspaceRoot(): Promise<string> {
    const settings = await this.context.settings.get().catch(() => ({})) as Record<string, unknown>;
    const configured = CoercionUtils.toString(settings?.workspaceRoot);
    if (configured) return path.resolve(configured);

    // The workspace is derived from the slug, so the rename pointed it at a new, empty directory and
    // left every archive already built in the old one — still on disk, unreachable from the screen.
    const root = path.resolve(ProjectPaths.getProjectRoot(), 'data', 'sources');
    LegacyWorkspaceAdoption.adopt(root, (message) => this.context.logger.info(message));
    return root;
  }

  async initialize(): Promise<void> {
    const { logger, db } = this.context;

    this.context.collections.register(BuildsCollection as any);
    // Declared so the workspace is visible and changeable in admin, not implied by process.cwd().
    this.context.settings.register(SourcesSettingsSchema.getSettingsSchema(
      (key, fallback) => this.context.i18n.translateOrFallback(key, fallback),
    ));

    // The agent's OWN workspace — never the directory the platform runs from.
    //
    // These used to resolve against `process.cwd()`. In the api container that is `/app`, which the app
    // user cannot write (EACCES on every boot), and `/app/plugins` and `/app/themes` are the LIVE
    // mounted repositories — so the failure was the only thing preventing build output from being
    // written over the sources it packages. The operator can see and change this in settings.
    const workspaceRoot = await this.resolveWorkspaceRoot();
    const sourceDir = path.resolve(workspaceRoot, 'source');
    const coreOutputDir = path.resolve(workspaceRoot, 'core');
    const pluginsOutputDir = path.resolve(workspaceRoot, 'plugins');
    const themesOutputDir = path.resolve(workspaceRoot, 'themes');
    logger.info(`Build workspace: ${workspaceRoot}`);

    logger.info('Initializing Sources...');

    // Wire services
    // The framework's secrets surface, so a token is encrypted with the installation's own key.
    const secretService = new BuildSourceSecretService((this.context as any).secrets);
    const buildSourceService = new BuildSourceService(db, secretService);
    const gitSync = new GitSyncService(sourceDir);
    const packageBuilder = new PackageBuilder(this.context, pluginsOutputDir, themesOutputDir, coreOutputDir);
    const buildService = new BuildService(
      db, gitSync, packageBuilder, buildSourceService,
      (event) => { void this.context.hooks.emit(SourcesEvents.PACKAGE_BUILT, event); },
    );

    // Mount API routes via plugin context
    BuildApiRegistrar.register(this.context, buildService);
    BuildPackageArtifactHook.register(this.context, buildService);
    BuildPackageDownloadHook.register(this.context, buildService);
    BuildSourceDeleteHook.register(this.context, buildService);
    BuildSourceListHook.register(this.context, buildService);
    BuildSourceSyncHook.register(this.context, buildService);
    BuildTriggerHook.register(this.context, buildService);
    BuildUpdatesCheckHook.register(this.context, buildService);
    await this.encryptStoredSecrets(buildSourceService);

    /**
     * Offer every built version to the admin's catalogue.
     *
     * This is what makes a new version visible on the Plugins screen without anyone opening Sources:
     * the counter, the badge and the update action all read that catalogue already.
     */
    try {
      this.context.catalog.contribute(async () => CatalogContributionService.entriesFrom(
        await buildSourceService.listSanitizedSources(),
      ));
      logger.info('Offering built versions to the admin catalogue.');
    } catch (error: unknown) {
      // Never fatal: the screen still works, the Plugins list simply will not learn about versions
      // built here. Saying so is what stops that looking like "there is nothing new".
      logger.warn(`Could not offer built versions to the catalogue: ${this.getErrorMessage(error)}`);
    }

    // Optional auto-build polling
    this.startPolling(buildService);

    logger.info('Sources initialized.');
  }

  private async encryptStoredSecrets(buildSourceService: BuildSourceService): Promise<void> {
    try {
      await buildSourceService.encryptStoredSecrets();
    } catch (error: unknown) {
      this.context.logger.warn(`Legacy build source token migration skipped: ${this.getErrorMessage(error)}`);
    }
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Check the tracked sources on a schedule, and build the ones whose operator asked for it.
   *
   * A registered scheduler task, not `setInterval` behind `AUTO_BUILD_INTERVAL_MINUTES`. The
   * environment variable was the whole feature's off switch and no admin screen mentioned it, so the
   * per-source "Build automatically" toggle promised something that could not happen — a control
   * that implies what it cannot do, which is the one thing this admin is not allowed to have.
   *
   * The task runs whether or not any source has the toggle on; `checkAndBuildUpdates` decides what
   * to do, and with nothing opted in it costs one `ls-remote` per source and builds nothing. The
   * scheduler is also the surface an operator can already SEE — its next run shows on the dashboard.
   */
  private startPolling(buildService: BuildService): void {
    const schedule = String(process.env.AUTO_BUILD_SCHEDULE || '').trim() || SourcesBootstrap.DEFAULT_SCHEDULE;

    void this.context.scheduler
      .register('auto-build', schedule, async () => {
        const results = await buildService.checkAndBuildUpdates();
        if (results.length === 0) return;
        const built = results.filter((result) => result.success).length;
        this.context.logger.info(`Auto-build: ${built}/${results.length} succeeded`);
      })
      .then(() => this.context.logger.info(`Auto-build scheduled (${schedule}).`))
      .catch((error: unknown) => {
        // Never fatal: the screen and manual builds work regardless. Saying so is what stops the
        // toggle looking like it is armed when nothing is going to run it.
        this.context.logger.warn(`Auto-build could not be scheduled: ${this.getErrorMessage(error)}`);
      });
  }
}
