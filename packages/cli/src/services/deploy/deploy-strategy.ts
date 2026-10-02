import { ComposeStack } from '@cli/services/deploy/compose-stack';
import { DeployCapacity, DeployMode } from '@fromcode119/core';
import { RemoteShell } from '@cli/services/deploy/remote-shell';

/**
 * Rolling or restart — the operator's choice, unless the release or the box rules it out.
 *
 * The choice is the platform setting `deploy_mode` (Settings → Infrastructure → Deployments), read from
 * the platform's own database on the box. Rolling is refused, with the reason printed, when:
 *  - the release carries a core migration the database has not run that does not declare itself
 *    `rollingSafe`. The new api migrates while the old one is still serving, and a renamed or dropped
 *    column would break the old one for that minute. A purely additive one (a new table, a new index)
 *    says so, and rolls;
 *  - the box does not have the memory to run a second copy of the largest app while it is swapped.
 * Either way the deploy still happens, as a restart: nothing is left half-done because rolling was out.
 */
export class DeployStrategy {
  /** The apps swapped one at a time; the gateway after them — rolled too when `edge` holds the ports. */
  static readonly ROLLED = ['api', 'admin', 'frontend'] as const;

  constructor(
    private readonly stack: ComposeStack,
    private readonly shell: RemoteShell,
  ) {}

  /** Call after `.env` names the new version: the migration check reads that image. */
  async choose(): Promise<{ mode: DeployMode; reason: string }> {
    const stored = DeployMode.resolve(await this.stack.query("SELECT value FROM _system_meta WHERE key = 'deploy_mode' AND tenant_id IS NULL"));
    if (stored !== DeployMode.ROLLING) return { mode: DeployMode.RESTART, reason: 'the deploy mode is set to restart' };

    // The release that introduces `edge` moves the public ports from the gateway to it — one gap, taken
    // once, in a restart. Rolled, the new `edge` could not bind ports the running gateway still holds.
    if ((await this.stack.declared([ComposeStack.EDGE])).length && !(await this.stack.containerIds(ComposeStack.EDGE)).length) {
      return { mode: DeployMode.RESTART, reason: 'this release introduces the edge, which takes ports 80 and 443 from the gateway — once, with a restart; later deploys roll' };
    }

    const pending = await this.pendingMigrations();
    if (pending) return { mode: DeployMode.RESTART, reason: `this release runs ${pending} (new core migrations need the old api stopped first)` };

    const capacity = DeployCapacity.from(
      (await this.shell.run('free -b')).stdout,
      (await this.shell.run("docker stats --no-stream --format '{{.Name}}|{{.MemUsage}}'")).stdout,
      DeployStrategy.ROLLED,
    );
    if (!capacity.fits) return { mode: DeployMode.RESTART, reason: `not enough memory: ${capacity.describe()}` };
    return { mode: DeployMode.ROLLING, reason: capacity.describe() };
  }

  /**
   * "migration 55" style description of what the new image would run that the serving release cannot run
   * beside, or '' when nothing. Additive migrations that declare `rollingSafe` are not counted.
   */
  private async pendingMigrations(): Promise<string> {
    const shipped = await this.stack.shippedMigrations();
    // An image that could not be listed must not pass for "nothing to migrate".
    if (!shipped.length) return 'migrations that could not be listed';
    const applied = Number(await this.stack.query("SELECT COALESCE(MAX(version), 0) FROM _system_migrations WHERE name NOT LIKE 'plugin:%'")) || 0;
    const blocking = shipped.filter((migration) => migration.version > applied && !migration.rollingSafe).map((migration) => migration.version).sort((a, b) => a - b);
    if (!blocking.length) return '';
    return blocking.length === 1 ? `migration ${blocking[0]}` : `migrations ${blocking.join(', ')}`;
  }
}
