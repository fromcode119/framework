import { EdgeRuleSnapshot } from '@fromcode119/core';
import type { IEdgeRuleSource } from '@cli/services/edge/interfaces/edge-rule-source.interface';

/** `rules.source: none` — the edge refuses nothing on its own; every connection goes to its server. */
export class EdgeStaticRules implements IEdgeRuleSource {
  readonly current = EdgeRuleSnapshot.of([], [], 0);
  readonly fresh = true;
  start(): void {}
  stop(): void {}
  async report(): Promise<void> {}
}
