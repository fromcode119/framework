import { BaseRouter, PluginManager, RouteConstants } from '@fromcode119/core';
import { AuthManager } from '@fromcode119/auth';
import { MediaManager } from '@fromcode119/media';
import { FilesController } from '@api/controllers/files-controller';
import { FileShareAdminController } from '@api/controllers/file-share-admin-controller';

/**
 * Private-file delivery.
 *
 * The recipient routes carry NO auth guard, and that is deliberate — most recipients have no account,
 * and the signed token in the path is the credential. This mirrors the email-preferences token routes,
 * which are unguarded for the same reason. Both derive identity from the token alone and ignore any
 * address supplied in the request, so neither can be aimed at a stranger.
 */
export class FilesRouter extends BaseRouter {
  private readonly controller: FilesController;
  private readonly adminController: FileShareAdminController;

  constructor(
    private manager: PluginManager,
    private auth: AuthManager,
    private mediaManager: MediaManager,
    private settingsCache: Map<string, string>,
  ) {
    super();
    this.controller = new FilesController(manager, mediaManager, settingsCache);
    this.adminController = new FileShareAdminController(manager, settingsCache);
  }

  protected registerRoutes(): void {
    // ORDER IS LOAD-BEARING. `/:token` matches any single segment, so it would swallow `/shares` and
    // every admin route below it — an operator's share list would be resolved as a token named
    // "shares", fail, and return the generic refusal. Literal paths first.
    const adminGuard = this.auth.guard(['admin']);
    const { FILES_SHARES, FILES_SHARE_ID, FILES_SHARE_GRANTS, FILES_SHARE_ACTIVITY, FILES_ACTIVITY, FILES_GRANT_ID, FILES_MEDIA_GRANTS, FILES_MY_SHARES, FILES_MY_DOWNLOAD, FILES_TOKEN, FILES_TOKEN_DOWNLOAD } = RouteConstants.SEGMENTS;

    this.post(FILES_SHARES, adminGuard, this.adminController.createShare);
    this.get(FILES_SHARES, adminGuard, this.adminController.listShares);
    this.get(FILES_SHARE_GRANTS, adminGuard, this.adminController.listGrants);
    this.post(FILES_SHARE_GRANTS, adminGuard, this.adminController.addRecipients);
    this.get(FILES_SHARE_ACTIVITY, adminGuard, this.adminController.shareActivity);
    this.get(FILES_ACTIVITY, adminGuard, this.adminController.activityOverview);
    this.patch(FILES_SHARE_ID, adminGuard, this.adminController.updateShare);
    this.patch(FILES_GRANT_ID, adminGuard, this.adminController.updateGrant);
    this.delete(FILES_SHARE_ID, adminGuard, this.adminController.revokeShare);
    this.delete(FILES_GRANT_ID, adminGuard, this.adminController.revokeGrant);
    this.get(FILES_MEDIA_GRANTS, adminGuard, this.adminController.listGrantsForMedia);

    // Signed-in recipients' own files, for the account area. Also literal paths, so they must precede
    // `/:token` for the same reason.
    this.get(FILES_MY_SHARES, this.auth.guard(), this.controller.listMine);
    this.get(FILES_MY_DOWNLOAD, this.auth.guard(), this.controller.downloadMine);

    // Recipient-facing, unguarded: the token is the credential.
    this.get(FILES_TOKEN, this.controller.resolve);
    this.get(FILES_TOKEN_DOWNLOAD, this.controller.download);
  }
}
