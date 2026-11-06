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
  static readonly UPDATER_KEY = 'FROMCODE_UPDATER';
  /** The release-named spelling of the same switch, still honoured where an existing `.env` sets it. */
  static readonly LEGACY_UPDATER_KEY = 'ATLANTIS_UPDATER';

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
   * deployers on one box race each other. So a `.env` that says nothing about the updater is told
   * `FROMCODE_UPDATER=off`. An explicit value — an operator who wants the box to update itself — is kept
   * exactly as it is. A value under the release-named spelling `ATLANTIS_UPDATER` is moved to the
   * current name with the same value, so a box never carries the old name past its next deploy — and
   * never both, which would leave two switches disagreeing about one updater.
   */
  async handUpdatesToThisCli(): Promise<void> {
    const key = DeploymentVersionStore.UPDATER_KEY;
    const legacy = DeploymentVersionStore.LEGACY_UPDATER_KEY;
    await this.shell.runOrThrow(
      `grep -qE '^${key}=' .env || ! grep -qE '^${legacy}=' .env || { sed -i.bak 's/^${legacy}=/${key}=/' .env && rm -f .env.bak; }`,
    );
    await this.shell.runOrThrow(
      `grep -qE '^${key}=' .env || { [ -z "$(tail -c1 .env)" ] || echo >> .env; printf '%s=off\\n' '${key}' >> .env; }`,
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
