import { Context as ReactorContext } from '@fromcode119/reactor';

export class SettingsContext {
  static readonly Context = new ReactorContext<Record<string, any>>({}).raw;
}
