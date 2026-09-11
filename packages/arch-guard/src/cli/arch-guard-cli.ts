#!/usr/bin/env node
import { AppTypecheckCommand } from './app-typecheck-command';
import { FileSizeCommand } from './file-size-command';
import { AppearanceBoundaryCommand } from './appearance-boundary-command';
import { ArchorCommand } from './arch-guard-command';
import { ClientViewMoveCommand } from './client-view-move-command';
import { ComponentMigrationCommand } from './component-migration-command';
import { ConventionGuardCommand } from './convention-guard-command';
import { CoreBoundaryCommand } from './core-boundary-command';
import { FrameworkDomainCommand } from './framework-domain-command';
import { BlockFieldConformanceCommand } from './block-field-conformance-command';
import { DependencyOverridesCommand } from './dependency-overrides-command';
import { DbFindWhereCommand } from './db-find-where-command';
import { RequestCoercionCommand } from './request-coercion-command';
import { ImportsCommand } from './imports-command';
import { InterfacePrefixCommand } from './interface-prefix-command';
import { OopGuardCommand } from './oop-guard-command';
import { PluginAliasCommand } from './plugin-alias-command';
import { PluginArchitectureCommand } from './plugin-architecture-command';
import { PluginUiHookfreeCommand } from './plugin-ui-hookfree-command';
import { PluginUiTypesCommand } from './plugin-ui-types-command';
import { McpToolSchemaCommand } from './mcp-tool-schema-command';
import { SdkBoundaryCommand } from './sdk-boundary-command';
import { SrcArtifactsCommand } from './src-artifacts-command';
import { ThemeOverrideBoundaryCommand } from './theme-override-boundary-command';
import { WorkspaceCheckCommand } from './workspace-check-command';

/**
 * The single `arch-guard` entry point: `arch-guard <command> [args…]`.
 *
 * One binary with subcommands, rather than a file per check invoked by path. A guard that silently
 * stops running is indistinguishable from a passing build, so an unknown or missing command is a HARD
 * failure (exit 2) that names what was asked for — never a quiet exit 0.
 */
export class ArchorCli {
  /** command name -> the class that implements it. */
  static readonly COMMANDS: ReadonlyMap<string, new () => ArchorCommand> = new Map<string, new () => ArchorCommand>([
    ['app-typecheck', AppTypecheckCommand],
    ['appearance-boundary', AppearanceBoundaryCommand],
    ['client-view-move', ClientViewMoveCommand],
    ['component-migration', ComponentMigrationCommand],
    ['convention-guard', ConventionGuardCommand],
    ['core-boundary', CoreBoundaryCommand],
    ['db-find-where', DbFindWhereCommand],
    ['dependency-overrides', DependencyOverridesCommand],
    ['file-size', FileSizeCommand],
    ['framework-domain', FrameworkDomainCommand],
    ['block-field-conformance', BlockFieldConformanceCommand],
    ['imports', ImportsCommand],
    ['interface-prefix', InterfacePrefixCommand],
    ['oop-guard', OopGuardCommand],
    ['plugin-alias', PluginAliasCommand],
    ['plugin-architecture', PluginArchitectureCommand],
    ['plugin-ui-hookfree', PluginUiHookfreeCommand],
    ['plugin-ui-types', PluginUiTypesCommand],
    ['request-coercion', RequestCoercionCommand],
    ['mcp-tool-schemas', McpToolSchemaCommand],
    ['sdk-boundary', SdkBoundaryCommand],
    ['src-artifacts', SrcArtifactsCommand],
    ['theme-override-boundary', ThemeOverrideBoundaryCommand],
    ['workspace-check', WorkspaceCheckCommand],
  ]);

  static main(argv: string[]): number {
    const [name, ...rest] = argv;

    if (!name || name === '--help' || name === '-h') return ArchorCli.usage(name ? 0 : 2);

    const command = ArchorCli.COMMANDS.get(name);
    if (!command) {
      console.error(`[arch-guard] unknown command "${name}".`);
      return ArchorCli.usage(2);
    }
    return new command().run(rest);
  }

  /** Print `arch-guard --help` and return the given exit code, so callers can use it as a tail call. */
  private static usage(code: number): number {
    const width = Math.max(...[...ArchorCli.COMMANDS.keys()].map((k) => k.length));
    const lines = [...ArchorCli.COMMANDS].map(([name, C]) => `  ${name.padEnd(width)}  ${new C().summary}`);
    const out = code === 0 ? console.log : console.error;
    out(`Usage: arch-guard <command> [args…]\n\nCommands:\n${lines.join('\n')}`);
    return code;
  }
}

process.exit(ArchorCli.main(process.argv.slice(2)));
