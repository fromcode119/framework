import { Enum } from '@fromcode119/reactor';

/** Control type of an integration provider config field. Authored as a wire string. */
export class IntegrationConfigFieldType extends Enum {
  static readonly TEXT = new IntegrationConfigFieldType('text');
  static readonly TEXTAREA = new IntegrationConfigFieldType('textarea');
  static readonly NUMBER = new IntegrationConfigFieldType('number');
  static readonly BOOLEAN = new IntegrationConfigFieldType('boolean');
  static readonly SELECT = new IntegrationConfigFieldType('select');
  static readonly PASSWORD = new IntegrationConfigFieldType('password');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw wire/plugin string to a member; defaults to TEXT. */
  static resolve(value: unknown): IntegrationConfigFieldType {
    if (value instanceof IntegrationConfigFieldType) return value;
    const found = IntegrationConfigFieldType.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as IntegrationConfigFieldType | undefined) ?? IntegrationConfigFieldType.TEXT;
  }
}
