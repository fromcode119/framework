export class ExecutionCardSummary {
  constructor(
    readonly changed: string,
    readonly where: string,
    readonly status: string,
  ) {}

  static from(raw: { changed: string; where: string; status: string }): ExecutionCardSummary {
    return new ExecutionCardSummary(raw.changed, raw.where, raw.status);
  }
}
