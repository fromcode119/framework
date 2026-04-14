export class SiteTransferBundleScriptRunner {
  static run(): Promise<void>;
  static resolveFrameworkRoot(): string;
  static createCommand(forwardedArgs: string[]): string[];
  static parseArgs(args: string[]): { forwardedArgs: string[]; help: boolean };
  static isAllowedArgument(value: string): boolean;
  static requiresValue(value: string): boolean;
  static printHelp(): void;
  static isDirectExecution(metaUrl: string): boolean;
}