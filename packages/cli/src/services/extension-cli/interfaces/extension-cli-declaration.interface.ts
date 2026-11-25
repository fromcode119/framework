import type { IExtensionCliCommand } from '@cli/services/extension-cli/interfaces/extension-cli-command.interface';

/** A declaration that was read and accepted, with the folder it came from. */
export interface IExtensionCliDeclaration {
  folder: string;
  commands: IExtensionCliCommand[];
  /** What each group of commands is, keyed by its path with spaces (`app`, `app sim`); shown in the group's `--help`. */
  groups: Record<string, string>;
}
