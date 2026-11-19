import type { IEventContract } from '@core/plugin/events/interfaces/event-contract.interface';
import type { IOnceOutcome } from '@core/plugin/events/interfaces/once-outcome.interface';

/**
 * Declared events and idempotent effects on the plugin context.
 *  - `define` records an event's payload contract (opt-in; validated on every emit and call).
 *  - `once` runs a side effect at most once per key for this plugin, so a retry or a duplicated
 *    provider callback does its work once.
 *  - `forget` gives a key back when what the effect produced was undone, so it may run again.
 */
export interface IPluginContextEvents {
  define(contract: IEventContract): void;
  once<T>(key: string, fn: () => Promise<T> | T): Promise<IOnceOutcome<T>>;
  forget(key: string): Promise<void>;
}
