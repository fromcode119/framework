import { BaseMigration, IDatabaseManager } from '@fromcode119/database';

/**
 * The signed tenant binding (TenantBindingSql): the owner-only key and the verifier functions every
 * tenant policy calls.
 *
 * Boot installs them before either pool has a connection (`prepareTenantBinding`, the first step of
 * init), and this migration repeats that — idempotently — for one reason that matters more than the
 * install itself: it makes the release that introduces the binding carry a PENDING core migration, and
 * the deploy CLI never rolls a release with one (DeployStrategy: "new core migrations need the old api
 * stopped first"). An old api replica does not sign its bindings, so under the new policies it would
 * see no site's rows at all; with this migration it is stopped before the new one starts instead of
 * serving empty pages beside it.
 */
export class SignedTenantBindingMigration extends BaseMigration {
  readonly version = 57;
  readonly name = 'Signed tenant binding';

  async up(db: IDatabaseManager): Promise<void> {
    await db.prepareTenantBinding();
  }
}
