export class SelectOption {
  constructor(readonly value: string, readonly label: string) {}

  static from(raw: { value: string; label: string }): SelectOption {
    return new SelectOption(raw.value, raw.label);
  }
}
