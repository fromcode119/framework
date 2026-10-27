import { Enum } from '@fromcode119/react-class-components/lang';

/**
 * What a person field holds. The type decides the control an editor shows (admin, app, any client) and
 * how a value is checked before it is stored — so a client that knows these types can ask for a new
 * field without being rebuilt.
 */
export class PersonFieldType extends Enum {
  static readonly TEXT = new PersonFieldType('text');
  static readonly LONG_TEXT = new PersonFieldType('longText');
  static readonly NUMBER = new PersonFieldType('number');
  static readonly BOOLEAN = new PersonFieldType('boolean');
  static readonly DATE = new PersonFieldType('date');
  static readonly TIME = new PersonFieldType('time');
  static readonly DATETIME = new PersonFieldType('datetime');
  static readonly PLACE = new PersonFieldType('place');
  static readonly CHOICE = new PersonFieldType('choice');
  static readonly CHOICES = new PersonFieldType('choices');

  private constructor(value: string) {
    super(value);
  }
}
