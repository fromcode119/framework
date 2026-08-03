import { Enum } from '@fromcode119/reactor';

/** How a seeder callable was found on the module. */
export class SeederCallableSourceType extends Enum {
  static readonly DEFAULT = new SeederCallableSourceType('default');
  static readonly NAMED = new SeederCallableSourceType('named');
  static readonly STATIC = new SeederCallableSourceType('static');

  private constructor(value: string) {
    super(value);
  }
}
