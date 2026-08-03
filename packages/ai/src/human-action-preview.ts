export class HumanActionPreview {
  constructor(
    readonly title: string,
    readonly target: string,
    readonly summary: string,
    readonly fieldPreviews: Array<{ field: string; value: string }>,
  ) {}

  static from(raw: {
    title: string;
    target: string;
    summary: string;
    fieldPreviews: Array<{ field: string; value: string }>;
  }): HumanActionPreview {
    return new HumanActionPreview(raw.title, raw.target, raw.summary, raw.fieldPreviews);
  }
}
