import type { ThemeContextType } from '@/components/theme-context.interfaces';
import type { BackupsPageControllerState } from './backups-page-client.interfaces';

export interface BackupsPageClientViewProps {
  theme: ThemeContextType['theme'];
  controller: BackupsPageControllerState;
}
