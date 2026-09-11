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

  async rollbackTarget(): Promise<string> {
    const out = await this.shell.run(`cat ${DeploymentVersionStore.ROLLBACK_FILE} 2>/dev/null`);
    return out.stdout.trim();
  }

  async rememberReplaced(version: string): Promise<void> {
    if (!version) return;
    await this.shell.runOrThrow(`printf '%s\\n' '${version}' > ${DeploymentVersionStore.ROLLBACK_FILE}`);
  }
}
