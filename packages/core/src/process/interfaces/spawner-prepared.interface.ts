/** What the privileged spawner made for one guest before it was started. */
export interface ISpawnerPrepared {
  /** Owned by the app's user, traversable by the guest's group: the app listens for the guest here. */
  hostDir: string;
  /** Owned by the guest's user, traversable by the app's group: the guest serves the app from here. */
  guestDir: string;
  /** Anything that could not be done (a bind mount that refuses `chown`) — reported, never hidden. */
  warnings: string[];
}
