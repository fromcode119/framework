export interface IAccountFile {
  id: string | number;
  name: string;
  /** Bytes. `0`/absent renders nothing rather than a fabricated size. */
  size?: number;
  /**
   * A ready-to-use download URL. Never a raw storage path: every entitled download in this platform
   * goes through a gate that re-checks access, and handing the panel a storage URL would bypass it.
   */
  href: string;
}
