export interface IDeclaredIndex {
  name: string;
  /** snake_case column names, in declared order. */
  columns: string[];
  unique: boolean;
}
