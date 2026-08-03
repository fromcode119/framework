import { PluginDefaultPageContractAssociationPersistStatus } from '@core/default-page-contract/enums/plugin-default-page-contract-association-persist-status.enum';

export interface IPluginDefaultPageContractAssociationPersistResult {
  canonicalKey: string;
  pageId: number | string;
  status: PluginDefaultPageContractAssociationPersistStatus;
  reason?: string;
}
