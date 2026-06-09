import type { Person } from '../people-page.interfaces';

export interface PersonAccountPanelProps {
  person: Person;
  theme: string;
  granting: boolean;
  onGrantLogin: () => void;
}
