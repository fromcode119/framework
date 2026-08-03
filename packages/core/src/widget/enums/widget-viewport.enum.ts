import { Enum } from '@fromcode119/reactor';

/** Which viewports a widget style applies to. */
export class WidgetViewport extends Enum {
  static readonly ALL = new WidgetViewport('all');
  static readonly DESKTOP = new WidgetViewport('desktop');
  static readonly MOBILE = new WidgetViewport('mobile');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw plugin/wire string to a member; defaults to ALL. */
  static resolve(value: unknown): WidgetViewport {
    if (value instanceof WidgetViewport) return value;
    const found = WidgetViewport.fromValue(String(value ?? '').trim());
    return (found as WidgetViewport | undefined) ?? WidgetViewport.ALL;
  }
}
