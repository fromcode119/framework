import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractBackfillAction } from '@core/default-page-contract/enums/plugin-default-page-contract-backfill-action.enum';
import { PluginDefaultPageContractBackfillStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-backfill-status.enum';

export interface IPluginDefaultPageContractBackfillPlanEntry {
  canonicalKey: string;
  namespace: string;
  pluginSlug: string;
  key: string;
  action: PluginDefaultPageContractBackfillAction;
  status: PluginDefaultPageContractBackfillStatus;
  matchedPageId?: number | string;
  existingAssociationPageId?: number | string;
  lookupCandidates: string[];
  reasons: string[];
  materializationMode: PluginDefaultPageContractMaterializationMode;
}
