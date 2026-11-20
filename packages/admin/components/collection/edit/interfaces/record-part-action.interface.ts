/** Something another plugin offers to start from this record — the console's copy of IEntityRecordAction. */
export interface IRecordPartAction {
  id: string;
  label: string;
  href: string;
  icon?: string;
  part?: string;
  /** Why it cannot be started now; the action is drawn switched off with this reason. */
  unavailable?: string;
}
