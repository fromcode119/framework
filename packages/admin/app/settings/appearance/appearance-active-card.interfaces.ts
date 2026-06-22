import type { AppearanceItem } from './appearance-item.interfaces';
import type { AppearanceCatalogItem } from './appearance-catalog-item.interfaces';

export interface AppearanceActiveCardProps {
  items: AppearanceItem[];
  catalogBySlug: Record<string, AppearanceCatalogItem>;
  active: string;
  busy: boolean;
  dark: boolean;
  onSwitch: (slug: string) => void;
  onUpdate: (item: AppearanceItem) => void;
  onRemove: (slug: string) => void;
}
