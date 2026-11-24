import type { EdgeRuleSnapshot } from '@fromcode119/core';

/** Where an edge's refusals come from (configuration `rules.source`). Another source is a new class, not a change to the edge. */
export interface IEdgeRuleSource {
  /** The rules in force now; empty until the first are known. */
  readonly current: EdgeRuleSnapshot;
  /** Whether the rules are as current as the source can make them — part of `/ready`. */
  readonly fresh: boolean;
  start(): void;
  stop(): void;
  /** What this edge refused since the last report, for a source that takes reports. */
  report(refused: Record<string, number>): Promise<void>;
}
