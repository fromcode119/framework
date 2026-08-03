export interface IShortcodeDefinition {
  name: string;
  provider: string;
  description: string;
  aliases?: string[];
  attributes: string[];
}
