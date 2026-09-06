export interface IOption {
  label: string;
  value: string;
  group?: string;
  section?: string;
  /**
   * The option can be removed by the operator. Only meaningful when the Select also receives
   * `onDeleteOption`; the menu then shows a remove affordance on this row. The OWNER of the option set
   * decides which rows carry this — the Select never infers it.
   */
  deletable?: boolean;
}
