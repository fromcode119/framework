import { SetupPhase } from '@core/tenant/enums/setup-phase.enum';

/**
 * Is this deployment still waiting to be claimed?
 *
 * A platform that has never been set up has nothing to route by: no tenants, and no admin domain
 * configured. The gateway's rule for a host it does not recognise is a 404, fail-closed and
 * deliberately so — which leaves a fresh install with no host that answers, and no way in.
 *
 * Setup mode is the ONE exception, and it is deliberately narrow:
 *
 *  - DECIDED AT BOOT, from the database, exactly like {@link TenantMode}. Not re-evaluated per
 *    request, so nothing an attacker can do to a table flips it back on while the process runs.
 *  - It requires EVERY signal of emptiness at once — no users, no tenants, no admin domain, and no
 *    completion marker. Deleting one table does not reopen it; only a genuinely fresh database does.
 *  - It CLOSES ON A TIMER. An install that nobody claims stops being claimable, so a forgotten box
 *    does not sit open indefinitely — the case that actually costs people their servers.
 *  - It CLOSES ON FIRST CLAIM. The first browser to begin setup owns it; a second party arriving
 *    mid-install is refused rather than racing for the admin account.
 *  - Once completed it can only be re-entered by restarting with an empty database.
 *
 * It asks its questions in TWO phases, separated by a process restart — see {@link SetupPhase}. The
 * bullets above describe the platform phase, which is the one with a database to read. The database
 * phase is opened by {@link configureUnconfigured} instead, because a deployment being asked where
 * its database is has no table any of those four signals could come from.
 *
 * What it is NOT: protection against someone who reaches the platform before the operator does.
 * Nothing decided by the server alone can tell those two apart — both are simply the first request.
 * That window is the accepted trade for an install that needs no secret passed out of band, and the
 * wizard says so on screen rather than leaving it implied.
 */
export class SetupMode {
  /** Long enough to read the screen and think about a hostname; short enough that it matters. */
  static readonly WINDOW_MS = 15 * 60 * 1000;

  private static active = false;
  private static openedAt = 0;
  private static claimedBy: string | null = null;
  private static phase: SetupPhase = SetupPhase.PLATFORM;
  private static now: () => number = () => Date.now();

  /**
   * Decided once at boot. Every input must say "untouched" for setup to open.
   *
   * `adminHostConfigured` is the important one: a deployment that knows its own admin domain has
   * been set up, whatever else is or is not in the database.
   */
  static configure(input: {
    userCount: number;
    tenantCount: number;
    adminHostConfigured: boolean;
    setupCompleted: boolean;
  }): void {
    SetupMode.active = input.userCount === 0
      && input.tenantCount === 0
      && !input.adminHostConfigured
      && !input.setupCompleted;
    SetupMode.openedAt = SetupMode.active ? SetupMode.now() : 0;
    SetupMode.claimedBy = null;
    SetupMode.phase = SetupPhase.PLATFORM;
  }

  /**
   * Open setup for a deployment that has no database to ask.
   *
   * Every other signal this class reads lives IN the database, which a deployment being asked where
   * its database is does not have. There is nothing to check and nothing that could be faked: a
   * process holding no connection string can serve nothing but this question, so the emptiness is
   * not inferred from a table, it is the state of the process.
   *
   * The window and the first-claimant lock still apply, and they matter MORE here than in the
   * platform phase — this is the request that decides which database the installation will use.
   */
  static configureUnconfigured(): void {
    SetupMode.active = true;
    SetupMode.openedAt = SetupMode.now();
    SetupMode.claimedBy = null;
    SetupMode.phase = SetupPhase.DATABASE;
  }

  /**
   * Which question setup is currently asking.
   *
   * The wizard needs this to know whether to show the database step at all — a deployment that was
   * given a `DATABASE_URL` must never be asked, and after the database step the process restarts
   * into the platform phase and must not ask again.
   */
  static currentPhase(): SetupPhase {
    return SetupMode.phase;
  }

  /**
   * Is setup open RIGHT NOW — still within the window, and not already claimed by someone else?
   *
   * The window is checked here rather than by a timer so there is nothing to cancel, and so a
   * process that was asleep cannot wake up with setup still open.
   */
  static isActive(): boolean {
    if (!SetupMode.active) return false;
    if (SetupMode.now() - SetupMode.openedAt > SetupMode.WINDOW_MS) return false;
    return true;
  }

  /** Why setup is not open, in the words the operator needs — for the screen, not a log. */
  static unavailableReason(): 'completed' | 'expired' | null {
    if (!SetupMode.active) return 'completed';
    if (SetupMode.now() - SetupMode.openedAt > SetupMode.WINDOW_MS) return 'expired';
    return null;
  }

  /**
   * Claim this installation for one party. The first caller wins; everyone else is refused.
   *
   * `claimant` is an opaque identity for the party setting up — an address, a generated id. It is
   * only ever compared with itself, never parsed or trusted as a fact about the network.
   */
  static claim(claimant: string): boolean {
    if (!SetupMode.isActive()) return false;
    const id = String(claimant || '').trim();
    if (!id) return false;
    if (SetupMode.claimedBy && SetupMode.claimedBy !== id) return false;
    SetupMode.claimedBy = id;
    return true;
  }

  /** Has someone already begun, and is this caller someone else? */
  static isClaimedByOther(claimant: string): boolean {
    const id = String(claimant || '').trim();
    return Boolean(SetupMode.claimedBy) && SetupMode.claimedBy !== id;
  }

  /**
   * Setup finished. Closes the exception permanently for this process.
   *
   * Re-entering needs a restart AND a database with none of the four signals — i.e. a fresh install.
   */
  static complete(): void {
    SetupMode.active = false;
    SetupMode.openedAt = 0;
    SetupMode.claimedBy = null;
    SetupMode.phase = SetupPhase.PLATFORM;
  }

  /** Test seam — resets the process flags and the clock. */
  static reset(clock: () => number = () => Date.now()): void {
    SetupMode.active = false;
    SetupMode.openedAt = 0;
    SetupMode.claimedBy = null;
    SetupMode.phase = SetupPhase.PLATFORM;
    SetupMode.now = clock;
  }
}
