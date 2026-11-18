import type { IEventContract } from '@core/plugin/events/interfaces/event-contract.interface';

/**
 * The declared shape of each event, so a listener knows what it receives and a payload that has drifted
 * away from it is caught — loudly in development and in the gate, quietly logged in production — instead
 * of reaching a listener as a surprise.
 *
 * Contracts are OPT-IN per event: an event nobody declared is emitted and delivered exactly as before,
 * with no validation and no warning, so adding this breaks nothing. An event that IS declared is checked
 * at every emit and call. The owner declares it once (`context.events.define`), typically at boot.
 */
export class EventContractRegistry {
  private static readonly contracts = new Map<string, IEventContract>();

  static define(contract: IEventContract): void {
    if (!contract?.event) return;
    const existing = EventContractRegistry.contracts.get(contract.event);
    // One owner must never overwrite another's contract — that would hijack the validation of an event
    // it does not own (weaken it, or make the real owner's payloads fail). Re-declaring your own is fine.
    if (existing?.owner && contract.owner && existing.owner !== contract.owner) return;
    EventContractRegistry.contracts.set(contract.event, contract);
  }

  static get(event: string): IEventContract | undefined {
    return EventContractRegistry.contracts.get(event);
  }

  static all(): IEventContract[] {
    return [...EventContractRegistry.contracts.values()];
  }

  /** For tests only: forget every contract so one suite's declarations do not leak into another. */
  static reset(): void {
    EventContractRegistry.contracts.clear();
  }

  /**
   * The reason a payload fails its event's contract, or null when it is fine — including when the event
   * declares no contract, or declares one with no schema. Never throws: a broken schema is not a reason
   * to break an emit.
   */
  static validate(event: string, payload: unknown): string | null {
    const contract = EventContractRegistry.contracts.get(event);
    if (!contract?.schema) return null;
    try {
      const result = contract.schema.safeParse(payload);
      if (result.success) return null;
      return result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
    } catch {
      return null;
    }
  }

  /** Development and the gate are strict (a drift throws); production logs and carries on. */
  static get strict(): boolean {
    return (process.env.NODE_ENV ?? 'development') !== 'production';
  }
}
