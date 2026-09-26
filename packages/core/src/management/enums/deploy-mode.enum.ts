import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * How a release replaces the running apps (Settings → Infrastructure → Deployments, `deploy_mode`).
 *
 *  - RESTART: every app is recreated at once. Simple, and every site is down for the ~45 s it takes.
 *  - ROLLING: one app at a time, the new copy serving before the old one stops. No downtime, but it
 *    needs memory for a second copy of the largest app, and a release with new core migrations still
 *    restarts (the old api cannot keep serving against a schema it does not know).
 */
export class DeployMode extends Enum {
  static readonly RESTART = new DeployMode('restart');
  static readonly ROLLING = new DeployMode('rolling');

  private constructor(value: string) {
    super(value);
  }

  /** A stored value (possibly JSON-quoted) to a member; anything unknown is the safe RESTART. */
  static resolve(value: unknown): DeployMode {
    if (value instanceof DeployMode) return value;
    const raw = String(value ?? '').trim().replace(/^"(.*)"$/, '$1').toLowerCase();
    return (DeployMode.fromValue(raw) as DeployMode | undefined) ?? DeployMode.RESTART;
  }
}
