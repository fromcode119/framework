import { IPluginDefaultPageContract } from '@core/default-page-contract/interfaces/plugin-default-page-contract.interface';
import { IPluginDefaultPageContractIdentity } from '@core/default-page-contract/interfaces/plugin-default-page-contract-identity.interface';

/**
 * A registered contract is the declaration composed with its identity — plain multiple inheritance.
 * TypeScript is single-inheritance; `@fromcode119/typor` extends it so this can stay a class.
 */
export interface IRegisteredPluginDefaultPageContract extends IPluginDefaultPageContract, IPluginDefaultPageContractIdentity {
  canonicalKey: string;
}
