import type { SeederCallableSymbol } from '@core/database/enums/seeder-callable-symbol.enum';
import type { SeederCallableSourceType } from '@core/database/enums/seeder-callable-source-type.enum';

/** A resolved seeder callable plus how it was found. */
export interface ISeederCallableResolution {
  callable: (...args: unknown[]) => unknown;
  symbolName: SeederCallableSymbol;
  sourceType: SeederCallableSourceType;
}
