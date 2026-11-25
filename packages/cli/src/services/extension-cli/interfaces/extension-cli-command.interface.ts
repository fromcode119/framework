/** One command an extension declares in its `fromcode.cli.json`. */
export interface IExtensionCliCommand {
  /** Where it sits in the command tree, e.g. `['app', 'sim', 'up']` → `fromcode app sim up`. */
  path: string[];
  description: string;
  /** Names of the positional arguments, e.g. `['<app>', '<name>']`. They are documented in help and passed on in order. */
  arguments?: string[];
  /** Options the command understands, so `--help` lists them. They are documentation: what was typed is passed on exactly as typed. */
  options?: Array<{ flags: string; description: string }>;
  /** Example command lines shown at the end of `--help`. */
  examples?: string[];
  /** The program and its fixed arguments. What the person typed after the command path is appended. */
  run: string[];
  /** Folder to run in, relative to the extension; default: the extension's own folder. */
  cwd?: string;
}
