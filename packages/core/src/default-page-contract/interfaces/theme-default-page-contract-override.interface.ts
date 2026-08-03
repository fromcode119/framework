import type { IPluginDefaultPageContractIdentity } from '@core/default-page-contract/interfaces/plugin-default-page-contract-identity.interface';

export interface IThemeDefaultPageContractOverride {
  contract: IPluginDefaultPageContractIdentity;
  slug?: string;
  aliases?: string[];
  title?: string;
  themeLayout?: string;
  styleVariant?: string;
  recipe?: string;
  install?: boolean;
}
