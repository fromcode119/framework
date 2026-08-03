import { InjectionTarget } from '@core/enums/injection-target.enum';

/**
 * The `context.ui` surface of {@link PluginContext}.
 *
 * Extracted from an anonymous inline object type: a plugin-facing CONTRACT deserves a name it can be
 * referenced by, and 25 of these inline in one class put the file at 366 lines.
 */
export interface IPluginContextUi {
  registerHeadInjection(injection: {
    tag: string;
    props: Record<string, any>;
    content?: string;
    target?: InjectionTarget;
  }): void;
}
