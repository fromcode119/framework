/** A record the list changes after a drag: its id and only the fields that moved. */
export class ListRecordChange {
  constructor(readonly id: string, readonly data: Record<string, unknown>) {}
}
