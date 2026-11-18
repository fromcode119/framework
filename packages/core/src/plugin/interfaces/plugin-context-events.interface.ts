import type { IEventContract } from '@core/plugin/events/event-contract-registry';
import type { IOnceOutcome } from '@core/plugin/events/event-idempotency';

/**
 * Declared events and idempotent effects on the plugin context.
 *  - `define` records an event's payload contract (opt-in; validated on every emit and call).
 *  - `once` runs a side effect at most once per key for this plugin, so a retry or a duplicated
 *    provider callback does its work once.
 */
export interface IPluginContextEvents {
  define(contract: IEventContract): void;
  once<T>(key: string, fn: () => Promise<T> | T): Promise<IOnceOutcome<T>>;
}
