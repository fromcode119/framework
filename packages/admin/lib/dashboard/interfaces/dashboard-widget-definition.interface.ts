import type { ReactNode } from 'react';
import type { DashboardWidgetSize } from '@fromcode119/core/client';

/** One widget the dashboard can show — a built-in panel or one a plugin declares in its manifest. */
export interface IDashboardWidgetDefinition {
  /** `system.<id>` or `plugin.<slug>.<id>`: stable, because saved layouts refer to it. */
  key: string;
  label: string;
  description: string;
  /** Who offers it — a plugin's name, or '' for the console's own panels. */
  source: string;
  size: DashboardWidgetSize;
  defaultVisible: boolean;
  render: () => ReactNode;
}
