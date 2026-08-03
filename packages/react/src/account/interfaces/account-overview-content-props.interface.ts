import type { AccountSection } from '@react/account/account-section';
import type { IAccountSectionNavigate } from '@react/account/interfaces/account-section-navigate.interface';
import type { ISlotComponent } from '@react/interfaces/slot-component.interface';

export interface IAccountOverviewContentProps {
  contributors: ISlotComponent[];
  /** Every resolved account section, so the overview links to what is installed — never a fixed list. */
  sections: AccountSection[];
  /** Switches section in-shell; without it the overview's links would reload the whole document. */
  navigate?: IAccountSectionNavigate;
}
