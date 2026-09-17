import express from 'express';
import { AuthManager } from '@fromcode119/auth';
import { CoreServices, PlatformSettingsService, PluginManager, SecretService, SystemConstants } from '@fromcode119/core';
import { SourcesModule } from '@fromcode119/sources';
import { PlatformAdminGuard } from '@api/middlewares/platform-admin-guard';

/**
 * Mounting Sources — framework surface, wired like every other framework router.
 *
 * It used to arrive as a "plugin" the framework discovered, packed into a tarball and loaded through
 * a capability sandbox — to build the very extensions that sandbox exists to contain.
 */
export class SourcesModuleMount {
  static async router(
    manager: PluginManager,
    auth: AuthManager,
    platformAdmin: PlatformAdminGuard,
  ): Promise<express.Router> {
    return SourcesModule.install({
      // Blank resolves to `<project root>/data/sources` inside the module; the operator can point it
      // elsewhere in Settings, and nothing here invents a path.
      workspaceRoot: await PlatformSettingsService.resolve(
        process.env.SOURCES_WORKSPACE_ROOT,
        SystemConstants.META_KEY.SOURCES_WORKSPACE_ROOT,
        '',
      ),
      db: manager.db,
      // The installation's own encryption, for the repository tokens Sources stores. As a plugin this
      // arrived as `context.secrets`; wiring the module without it made every stored token
      // undecryptable — the list still rendered (it strips secrets) while pressing Build answered 500
      // with "no encryption key is configured", which reads as a build failure rather than a missing
      // dependency.
      secrets: {
        isConfigured: () => SecretService.isEncryptionAvailable(),
        encrypt: (value: string) => SecretService.encrypt(value),
        decrypt: (value: unknown) => SecretService.decrypt(value),
      },
      hooks: manager.hooks,
      // PLATFORM admin, not merely `admin`. Sources clones arbitrary git repositories onto the shared
      // container and BUILDS them, so the bare role guard let a tenant's own administrator — which is
      // what `admin` means on a multi-tenant deployment — list every other customer's repository URL
      // and recent commit subjects, download their built package, delete their source, and trigger a
      // clone-and-build of a repository of their choosing on the box every customer runs on.
      //
      // The data is deliberately global: migration 036 dropped the tenant column and the policy from
      // `_system_sources_builds` because Sources IS platform configuration. That decision was right;
      // the guard was simply never raised to match it, so the table stopped being tenant-scoped while
      // the routes stayed tenant-reachable. Every neighbouring platform router takes `platformAdmin`
      // for exactly this reason.
      adminGuard: [auth.guard(['admin']), platformAdmin.middleware()] as any,
      projectRoot: (manager as any).projectRoot,
      installer: manager,
      catalog: {
        // `resolveArtifact` is forwarded, not dropped: an offer from Sources is a file this
        // installation built, and its catalogue row carries only a filename. Without it the
        // installer resolved that name against the REMOTE marketplace and 404'd on a package that
        // had never been published there.
        contribute: (provider, resolveArtifact) => CoreServices.getInstance().catalogContributions.register({
          namespace: 'org.fromcode',
          pluginSlug: 'sources',
          list: provider as never,
          resolveArtifact,
        }),
      },
      scheduler: manager.scheduler,
    }).router;
  }
}
