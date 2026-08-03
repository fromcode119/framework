import { Enum } from '@fromcode119/reactor';

/**
 * The control type of an integration-provider config field. Authored server-side as a wire string in the
 * provider definitions and hydrated to a member at the INTEGRATIONS fetch boundary (read-only — field.type
 * is never sent back; saved config is keyed by field.name).
 */
export class IntegrationFieldType extends Enum {
  static readonly TEXT = new IntegrationFieldType('text');
  static readonly TEXTAREA = new IntegrationFieldType('textarea');
  static readonly NUMBER = new IntegrationFieldType('number');
  static readonly BOOLEAN = new IntegrationFieldType('boolean');
  static readonly SELECT = new IntegrationFieldType('select');
  static readonly PASSWORD = new IntegrationFieldType('password');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a wire string to a member; defaults to TEXT. */
  static resolve(value: unknown): IntegrationFieldType {
    if (value instanceof IntegrationFieldType) return value;
    const found = IntegrationFieldType.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as IntegrationFieldType | undefined) ?? IntegrationFieldType.TEXT;
  }
}
