import { Context as ReactorContext } from '@fromcode119/react-class-components';

export class SettingsContext {
  static readonly Context = new ReactorContext<Record<string, any>>({}).raw;
}
