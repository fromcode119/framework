import { PluginDefaultPageContractDependency } from '@core/default-page-contract/enums/plugin-default-page-contract-dependency.enum';
import { PluginDefaultPageContractKind } from '@core/default-page-contract/enums/plugin-default-page-contract-kind.enum';
import { PluginDefaultPageContractMaterializationMode } from '@core/default-page-contract/enums/plugin-default-page-contract-materialization-mode.enum';

export interface IPluginDefaultPageContract {
  key: string;
  kind: PluginDefaultPageContractKind;
  defaultSlug: string;
  recordCollection?: string;
  capability: string;
  recipe: string;
  title?: string;
  themeLayout?: string;
  styleVariant?: string;
  materializationMode: PluginDefaultPageContractMaterializationMode;
  dependencies: PluginDefaultPageContractDependency[];
  adoptionHints: string[];
  required: boolean;
  aliases?: string[];
  /**
   * Optional default block content the materializer writes when creating this page (instead
   * of an empty `[]`). Lets a plugin own its route AND its default block (e.g. an affiliate
   * portal block), so the theme only OVERRIDES the block renderer for branding — no theme/seed
   * needed to place the block.
   */
  defaultContent?: any[];
}
