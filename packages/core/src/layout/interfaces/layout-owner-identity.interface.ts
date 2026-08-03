import type { LayoutTargetKind } from '@core/layout/enums/layout-target-kind.enum';

export interface ILayoutOwnerIdentity {
  namespace: string;
  pluginSlug: string;
  targetKey: string;
  targetKind: LayoutTargetKind;
}
