/** One comparison a collection's read rule may state (see `ReadConstraintOperators`). */
export interface IReadConstraintOperator {
  $ne?: unknown;
  $lte?: unknown;
  $in?: unknown[];
  $orNull?: boolean;
}
