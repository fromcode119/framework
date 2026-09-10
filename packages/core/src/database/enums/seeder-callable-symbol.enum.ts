import { Enum } from '@fromcode119/react-class-components';

/** Exported symbol name a seeder module may expose. */
export class SeederCallableSymbol extends Enum {
  static readonly DEFAULT = new SeederCallableSymbol('default');
  static readonly SEED = new SeederCallableSymbol('seed');
  static readonly RUN = new SeederCallableSymbol('run');
  static readonly EXECUTE = new SeederCallableSymbol('execute');

  private constructor(value: string) {
    super(value);
  }
}
