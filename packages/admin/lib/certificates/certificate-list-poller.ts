/**
 * Re-reads the certificates list while any host is still waiting on the platform.
 *
 * An order runs in the background on the platform's own schedule, so without this a row the operator
 * is watching would sit on "Queued" until they thought to reload. It stops by itself as soon as
 * nothing is waiting, and on unmount.
 */
export class CertificateListPoller {
  private static readonly INTERVAL_MS = 15_000;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly reload: () => Promise<void> | void) {}

  /** Arms one re-read when `waiting` is true, replacing any pending one; disarms otherwise. */
  schedule(waiting: boolean): void {
    this.stop();
    if (waiting) this.timer = setTimeout(() => void this.reload(), CertificateListPoller.INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
