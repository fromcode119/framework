import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';
import { PluginDefaultPageContractMaterializationAction } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-action.enum';
import { PluginDefaultPageContractMaterializationStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-status.enum';
import type { IPluginDefaultPageContractCreatePayload } from '@core/default-page-contract/interfaces/plugin-default-page-contract-create-payload.interface';

export interface IPluginDefaultPageContractMaterializationPlanEntry {
  canonicalKey: string;
  namespace: string;
  pluginSlug: string;
  key: string;
  action: PluginDefaultPageContractMaterializationAction;
  lookupCandidates: string[];
  matchedPageId?: number | string;
  createPayload?: IPluginDefaultPageContractCreatePayload;
  reasons: string[];
  materializationMode: PluginDefaultPageContractMaterializationMode;
  status: PluginDefaultPageContractMaterializationStatus;
}
