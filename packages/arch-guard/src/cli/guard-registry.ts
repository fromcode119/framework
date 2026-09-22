import { AppTypecheckCommand } from './app-typecheck-command';
import { ExtendedExtendsCommand } from './extended-extends-command';
import { DomainTransportFallbackCommand } from './domain-transport-fallback-command';
import { ExtensionNameCommand } from './extension-name-command';
import { FileSizeCommand } from './file-size-command';
import { AppearanceBoundaryCommand } from './appearance-boundary-command';
import { ClientViewMoveCommand } from './client-view-move-command';
import { ComponentMigrationCommand } from './component-migration-command';
import { ConventionGuardCommand } from './convention-guard-command';
import { RenderedCopyCommand } from './rendered-copy-command';
import { CoreBoundaryCommand } from './core-boundary-command';
import { FrameworkDomainCommand } from './framework-domain-command';
import { BlockFieldConformanceCommand } from './block-field-conformance-command';
import { DeclaredFieldAssignmentCommand } from './declared-field-assignment-command';
import { DependencyOverridesCommand } from './dependency-overrides-command';
import { DialectSqlConfinementCommand } from './dialect-sql-confinement-command';
import { DbFindWhereCommand } from './db-find-where-command';
import { ReExportCommand } from './re-export-command';
import { RequestCoercionCommand } from './request-coercion-command';
import { I18nKeyResolutionCommand } from './i18n-key-resolution-command';
import { IgnoredSourceCommand } from './ignored-source-command';
import { ImportsCommand } from './imports-command';
import { JsonFieldControlCommand } from './json-field-control-command';
import { PluginScriptCommand } from './plugin-script-command';
import { LooseScriptCommand } from './loose-script-command';
import { BlockRegistryDriftCommand } from './block-registry-drift-command';
import { SnakePropertyAccessCommand } from './snake-property-access-command';
import { SnakeTranslationKeyCommand } from './snake-translation-key-command';
import { InterfacePrefixCommand } from './interface-prefix-command';
import { OopGuardCommand } from './oop-guard-command';
import { PluginAliasCommand } from './plugin-alias-command';
import { PluginArchitectureCommand } from './plugin-architecture-command';
import { PluginRawSqlCommand } from './plugin-raw-sql-command';
import { PluginUiHookfreeCommand } from './plugin-ui-hookfree-command';
import { PluginUiTypesCommand } from './plugin-ui-types-command';
import { McpToolSchemaCommand } from './mcp-tool-schema-command';
import { OneContractPerFileCommand } from './one-contract-per-file-command';
import { SdkRuntimeExportsCommand } from './sdk-runtime-exports-command';
import { ScriptPathCommand } from './script-path-command';
import { SdkBoundaryCommand } from './sdk-boundary-command';
import { SingleExportModuleCommand } from './single-export-module-command';
import { SrcArtifactsCommand } from './src-artifacts-command';
import { SsrStaticImportCommand } from './ssr-static-import-command';
import { ThemeOverrideBoundaryCommand } from './theme-override-boundary-command';
import { WorkspaceCheckCommand } from './workspace-check-command';
import { ArchorCommand } from './arch-guard-command';

/**
 * Every `arch-guard` subcommand, name -> implementing class.
 *
 * Its own module because TWO things need it and one of them is a command: the CLI dispatches through
 * it, and `arch-guard ci` WALKS it to run every guard. Had it stayed on `ArchorCli`, the ci command
 * would have to import the dispatcher that imports the ci command. `ci` itself is deliberately absent
 * here — the dispatcher adds it — so this module imports nothing that imports it back.
 *
 * Walking a registry is also what keeps CI honest: a guard added here is enforced without anyone
 * remembering to also list it somewhere else, which is the failure mode that let ~40 guards exist
 * while nothing ran them.
 */
export class GuardRegistry {
  static readonly COMMANDS: ReadonlyMap<string, new () => ArchorCommand> = new Map<string, new () => ArchorCommand>([
    ['app-typecheck', AppTypecheckCommand],
    ['appearance-boundary', AppearanceBoundaryCommand],
    ['client-view-move', ClientViewMoveCommand],
    ['component-migration', ComponentMigrationCommand],
    ['convention-guard', ConventionGuardCommand],
    ['core-boundary', CoreBoundaryCommand],
    ['rendered-copy', RenderedCopyCommand],
    ['db-find-where', DbFindWhereCommand],
    ['declared-fields', DeclaredFieldAssignmentCommand],
    ['dependency-overrides', DependencyOverridesCommand],
    ['dialect-sql-confinement', DialectSqlConfinementCommand],
    ['domain-transport-fallback', DomainTransportFallbackCommand],
    ['extension-names', ExtensionNameCommand],
    ['i18n-keys', I18nKeyResolutionCommand],
    ['ignored-sources', IgnoredSourceCommand],
    ['json-field-controls', JsonFieldControlCommand],
    ['plugin-scripts', PluginScriptCommand],
    ['loose-scripts', LooseScriptCommand],
    ['block-registry-drift', BlockRegistryDriftCommand],
    ['snake-property-access', SnakePropertyAccessCommand],
    ['snake-translation-keys', SnakeTranslationKeyCommand],
    ['extended-extends', ExtendedExtendsCommand],
    ['file-size', FileSizeCommand],
    ['framework-domain', FrameworkDomainCommand],
    ['block-field-conformance', BlockFieldConformanceCommand],
    ['imports', ImportsCommand],
    ['interface-prefix', InterfacePrefixCommand],
    ['one-contract-per-file', OneContractPerFileCommand],
    ['oop-guard', OopGuardCommand],
    ['plugin-alias', PluginAliasCommand],
    ['plugin-architecture', PluginArchitectureCommand],
    ['plugin-raw-sql', PluginRawSqlCommand],
    ['plugin-ui-hookfree', PluginUiHookfreeCommand],
    ['plugin-ui-types', PluginUiTypesCommand],
    ['sdk-runtime-exports', SdkRuntimeExportsCommand],
    ['re-exports', ReExportCommand],
    ['request-coercion', RequestCoercionCommand],
    ['mcp-tool-schemas', McpToolSchemaCommand],
    ['script-paths', ScriptPathCommand],
    ['sdk-boundary', SdkBoundaryCommand],
    ['single-export-module', SingleExportModuleCommand],
    ['src-artifacts', SrcArtifactsCommand],
    ['ssr-static-imports', SsrStaticImportCommand],
    ['theme-override-boundary', ThemeOverrideBoundaryCommand],
    ['workspace-check', WorkspaceCheckCommand],
  ]);
}
