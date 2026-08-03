import type { ComponentType } from 'react';

export interface ISlotComponent {
  component: ComponentType<any>;
  priority: number;
  pluginSlug: string;
}
