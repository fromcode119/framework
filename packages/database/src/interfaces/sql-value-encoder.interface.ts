/** Turns an application value into the value a driver binds — a column does this for its own type. */
export interface ISqlValueEncoder {
  mapToDriverValue(value: unknown): unknown;
}
