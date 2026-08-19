/**
 * One restartable app as the api describes it: which app, where this install would reach it, and
 * whether it currently can.
 *
 * `restartable` is the api's verdict, not a guess made here — it is false when the deployment has no
 * internal secret or no URL for that app, which is exactly what the admin must show instead of an
 * inviting button that fails on click.
 */
export class AdminDeployApp {
  readonly app: string;

  /** The URL the api would POST to. Empty for the api itself, which exits in place. */
  readonly url: string;

  readonly restartable: boolean;

  private constructor(app: string, url: string, restartable: boolean) {
    this.app = app;
    this.url = url;
    this.restartable = restartable;
  }

  static from(row: Record<string, unknown> | null): AdminDeployApp {
    return new AdminDeployApp(String(row?.app || ''), String(row?.url || ''), row?.restartable === true);
  }
}
