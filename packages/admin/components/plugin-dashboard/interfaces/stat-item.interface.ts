import { StatColor } from '@/components/plugin-dashboard/enums/stat-color.enum';
import type { ReactNode } from 'react';

export interface IStatItem {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  // `StatColor | string`: a plugin bundle supplies this raw and is not type-checked against the
  // framework, so the contract states reality. `StatColor.resolve()` normalises it at the use site.
  color?: StatColor | string;
  href?: string;
}
