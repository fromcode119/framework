import { Enum } from '@fromcode119/reactor';

/** The primary action button the assistant offers. */
export class PrimaryAction extends Enum {
  static readonly NONE = new PrimaryAction('none');
  static readonly SEND = new PrimaryAction('send');
  static readonly PREVIEW = new PrimaryAction('preview');
  static readonly APPLY = new PrimaryAction('apply');

  private constructor(value: string) {
    super(value);
  }
}
