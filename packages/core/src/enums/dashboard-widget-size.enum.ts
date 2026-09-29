import { Enum } from '@fromcode119/react-class-components/lang';

/** How many of the dashboard's three columns a widget spans. */
export class DashboardWidgetSize extends Enum {
  static readonly SMALL = new DashboardWidgetSize('small');
  static readonly MEDIUM = new DashboardWidgetSize('medium');
  static readonly LARGE = new DashboardWidgetSize('large');

  private constructor(value: string) {
    super(value);
  }

  /** Resolve a raw value (a manifest string, a saved layout) to a member; defaults to SMALL. */
  static resolve(value: unknown): DashboardWidgetSize {
    if (value instanceof DashboardWidgetSize) return value;
    const found = DashboardWidgetSize.fromValue(String(value ?? '').trim().toLowerCase());
    return (found as DashboardWidgetSize | undefined) ?? DashboardWidgetSize.SMALL;
  }
}
