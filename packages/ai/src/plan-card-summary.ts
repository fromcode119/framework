export class PlanCardSummary {
  constructor(
    readonly goal: string,
    readonly found: string,
    readonly propose: string,
    readonly approval: string,
  ) {}

  static from(raw: { goal: string; found: string; propose: string; approval: string }): PlanCardSummary {
    return new PlanCardSummary(raw.goal, raw.found, raw.propose, raw.approval);
  }
}
