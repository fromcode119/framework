import { FilterKind } from '@core/data-sources/enums/filter-kind.enum';
import type { ILegacyProjection } from '@core/data-sources/interfaces/legacy-projection.interface';

export interface IFilterDefinition {
  key: string;
  label: string;
  inputType: FilterKind;
  defaultValue?: unknown;
  allowsDynamicOptions?: boolean;
  optionsHint?: string;
  legacyProjection?: ILegacyProjection;
}
