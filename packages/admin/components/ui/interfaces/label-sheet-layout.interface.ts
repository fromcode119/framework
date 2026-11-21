/** A sheet of labels: how many across and down, and each label's size in millimetres. */
export interface ILabelSheetLayout {
  columns: number;
  rows: number;
  widthMm: number;
  heightMm: number;
  /** Space above the first row, for papers whose labels do not start at the edge. */
  topMm?: number;
  /** Dashed cut lines around each label, for plain paper. On by default. */
  cutLines?: boolean;
}
