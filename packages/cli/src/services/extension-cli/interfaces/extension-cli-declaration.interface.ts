import type { IExtensionCliCommand } from '@cli/services/extension-cli/interfaces/extension-cli-command.interface';

/** A declaration that was read and accepted, with the folder it came from. */
export interface IExtensionCliDeclaration {
  folder: string;
  commands: IExtensionCliCommand[];
}
