/**
 * What actually happened when an operator asked for one app to restart.
 *
 * `restarting` is only true when that app confirmed it scheduled its own exit. Everything else —
 * no secret configured, no URL for the app, the app unreachable, the app refused — arrives as a
 * `reason`, because "the button did nothing and said nothing" is precisely the failure this whole
 * control exists to replace.
 */
export class ApplicationRestartOutcome {
  readonly app: string;

  readonly restarting: boolean;

  /** Milliseconds the target app will wait before exiting, as the target itself reported it. */
  readonly exitInMs: number;

  /** Why it is not restarting. Empty when it is. */
  readonly reason: string;

  private constructor(app: string, restarting: boolean, exitInMs: number, reason: string) {
    this.app = app;
    this.restarting = restarting;
    this.exitInMs = exitInMs;
    this.reason = reason;
  }

  static restarting(app: string, exitInMs: number): ApplicationRestartOutcome {
    return new ApplicationRestartOutcome(app, true, exitInMs, '');
  }

  static refused(app: string, reason: string): ApplicationRestartOutcome {
    return new ApplicationRestartOutcome(app, false, 0, reason);
  }

  toJSON(): Record<string, unknown> {
    return { app: this.app, restarting: this.restarting, exitInMs: this.exitInMs, reason: this.reason };
  }
}
