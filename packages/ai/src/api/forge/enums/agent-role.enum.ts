import { Enum } from '@fromcode119/reactor';

/** Role of a sub-agent in the multi-agent forge pipeline. */
export class AgentRole extends Enum {
  static readonly PLANNER = new AgentRole('planner');
  static readonly EXECUTOR = new AgentRole('executor');
  static readonly VERIFIER = new AgentRole('verifier');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire/stored string to a member; defaults to PLANNER. */
  static resolve(value: unknown): AgentRole {
    if (value instanceof AgentRole) return value;
    const found = AgentRole.fromValue(String(value ?? '').trim());
    return (found as unknown as AgentRole | undefined) ?? AgentRole.PLANNER;
  }
}
