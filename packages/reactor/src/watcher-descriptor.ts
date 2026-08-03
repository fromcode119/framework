/** Describes one `@watch`-registered method and the state/prop keys it observes. */
export class WatcherDescriptor {
  declare method: string;
  declare keys: string[];
}
