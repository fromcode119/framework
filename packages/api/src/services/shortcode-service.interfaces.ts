export interface ShortcodeDefinition {
  name: string;
  provider: string;
  description: string;
  aliases?: string[];
  attributes: string[];
}
