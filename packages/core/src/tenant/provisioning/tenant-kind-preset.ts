/** One declared starting point for a workspace: the plugins it runs and the appearance its domain is locked to. */
export class TenantKindPreset {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly description: string,
    readonly plugins: readonly string[],
    readonly appearance: string,
  ) {}

  toJSON(): Record<string, unknown> {
    return { id: this.id, label: this.label, description: this.description, plugins: [...this.plugins], appearance: this.appearance };
  }
}
