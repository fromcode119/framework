import { Enum } from '@fromcode119/reactor';

/** The data a collection/settings field holds — drives which admin control is rendered. */
export class FieldType extends Enum {
  static readonly TEXT = new FieldType('text');
  static readonly TEXTAREA = new FieldType('textarea');
  static readonly EMAIL = new FieldType('email');
  static readonly URL = new FieldType('url');
  static readonly TEL = new FieldType('tel');
  static readonly NUMBER = new FieldType('number');
  static readonly BOOLEAN = new FieldType('boolean');
  static readonly CHECKBOX = new FieldType('checkbox');
  static readonly DATE = new FieldType('date');
  static readonly DATETIME = new FieldType('datetime');
  static readonly SELECT = new FieldType('select');
  static readonly RELATIONSHIP = new FieldType('relationship');
  static readonly RICH_TEXT = new FieldType('richText');
  static readonly UPLOAD = new FieldType('upload');
  static readonly JSON = new FieldType('json');
  static readonly PASSWORD = new FieldType('password');
  static readonly ARRAY = new FieldType('array');
  static readonly GROUP = new FieldType('group');
  static readonly COLOR = new FieldType('color');
  static readonly CODE = new FieldType('code');
  static readonly PERMALINK = new FieldType('permalink');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw schema string to a member; defaults to TEXT (a plain input). */
  static resolve(value: unknown): FieldType {
    if (value instanceof FieldType) return value;
    const found = FieldType.fromValue(String(value ?? '').trim());
    return (found as FieldType | undefined) ?? FieldType.TEXT;
  }
}
