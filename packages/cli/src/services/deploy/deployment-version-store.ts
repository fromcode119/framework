import { RemoteShell } from '@cli/services/deploy/remote-shell';

/**
 * The version `.env` names, and the last version actually replaced.
 *
 * The second is kept in its own file because `.env` only ever holds the current one: after a deploy
 * it says what is running, so it cannot also answer "what would I roll back to" — and on a repeated
 * deploy of the same version it would answer that with the version being deployed.
 */
export class DeploymentVersionStore {
  private static readonly ROLLBACK_FILE = '.previous-version';
  /** The `.env` switch the updater service reads (`docker-compose.images.yml`). */
  static readonly UPDATER_KEY = 'ATLANTIS_UPDATER';

  constructor(private readonly shell: RemoteShell) {}

  async current(): Promise<string> {
    const out = await this.shell.run("grep -E '^VERSION=' .env | head -1 | cut -d= -f2");
    return out.stdout.trim();
  }

  async set(version: string): Promise<void> {
    // Appends when the key is absent, so a target whose .env predates versioned deploys still works.
    await this.shell.runOrThrow(
      `if grep -qE '^VERSION=' .env; then sed -i 's|^VERSION=.*|VERSION=${version}|' .env; else printf 'VERSION=%s\\n' '${version}' >> .env; fi`,
    );
  }

  /**
   * A target this CLI deploys is updated by this CLI, not by the platform's own updater service: two
   * deployers on one box race, and the updater restarts each app where this CLI rolls with no gap. So a
   * `.env` that says nothing about the updater is told `ATLANTIS_UPDATER=off`. An explicit value — an
   * operator who wants the box to update itself — is left exactly as it is.
   */
  async handUpdatesToThisCli(): Promise<void> {
    await this.shell.runOrThrow(
      `grep -qE '^${DeploymentVersionStore.UPDATER_KEY}=' .env || { [ -z "$(tail -c1 .env)" ] || echo >> .env; printf '%s=off\\n' '${DeploymentVersionStore.UPDATER_KEY}' >> .env; }`,
    );
  }

  async rollbackTarget(): Promise<string> {
    const out = await this.shell.run(`cat ${DeploymentVersionStore.ROLLBACK_FILE} 2>/dev/null`);
    return out.stdout.trim();
  }

  async rememberReplaced(version: string): Promise<void> {
    if (!version) return;
    await this.shell.runOrThrow(`printf '%s\\n' '${version}' > ${DeploymentVersionStore.ROLLBACK_FILE}`);
  }
}
