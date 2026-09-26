/**
 * What the api tells the spawner about a plugin process it starts, so that ANOTHER api can find it and
 * take it over (`SpawnerGuests.inventory`). The spawner stores it and hands it back; it never reads it.
 */
export interface ISpawnerGuestLabel {
  /** The plugin, its version and the heap its process was started with — what must match to take it over. */
  slug: string;
  version: string;
  memoryMb: number;
  /** The secret an api must present to attach (`PluginGuestConnections`). */
  attachSecret: string;
}
