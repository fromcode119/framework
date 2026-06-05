import type {
  ContentResolutionGate,
  ContentResolutionGateOptions,
  ContentResolutionResult,
} from './content-resolution-gate.types';

/**
 * Generic registry of content-resolution gates.
 *
 * Plugins register a transformer (keyed by a stable id, e.g. their namespace +
 * slug) that may rewrite a resolved document before it is sent to the client —
 * for example, replacing members-only content with a paywall block. The
 * framework stays plugin-agnostic: it only runs the registered gates in
 * registration order and returns the final result.
 *
 * Registration is idempotent per key: re-registering the same key replaces the
 * previous gate, so a plugin re-init never stacks duplicate gates.
 *
 * A gate that throws is skipped (its input is passed through unchanged) so one
 * misbehaving plugin can never break page resolution for everyone.
 */
export class ContentResolutionGateRegistryService {
  private readonly gates = new Map<string, ContentResolutionGate>();

  register(key: string, gate: ContentResolutionGate): void {
    if (!key || typeof gate !== 'function') return;
    this.gates.set(key, gate);
  }

  unregister(key: string): void {
    this.gates.delete(key);
  }

  clear(): void {
    this.gates.clear();
  }

  has(key: string): boolean {
    return this.gates.has(key);
  }

  async apply(
    result: ContentResolutionResult,
    options: ContentResolutionGateOptions,
  ): Promise<ContentResolutionResult> {
    let current = result;
    for (const gate of this.gates.values()) {
      try {
        current = await gate(current, options);
      } catch {
        // A failing gate must never break resolution — pass the prior value through.
      }
    }
    return current;
  }
}
