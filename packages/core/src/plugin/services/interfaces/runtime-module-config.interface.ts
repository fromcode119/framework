import { RuntimeModuleKind } from '@core/plugin/services/enums/runtime-module-kind.enum';

export interface IRuntimeModuleConfig {
  keys: string[];
  type: RuntimeModuleKind;
}
