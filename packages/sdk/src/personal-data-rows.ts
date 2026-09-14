/** Who a DSAR is about, as the privacy plugin resolves them. */
export interface IPersonalDataSubjectRef {
  email: string;
  personId?: string | number | null;
  userId?: string | number | null;
}

/** What a dataset did, in the shape the privacy plugin's fulfilment report expects. */
export interface IPersonalDataRowsResult {
  strategy: string;
  erased: number;
  anonymised: number;
  retained: number;
  remaining: number;
  retainedReason?: string;
}

/**
 * Find, delete and anonymise a subject's rows in ONE of this plugin's own tables.
 *
 * Every plugin that answers a DSAR was about to write the same three loops — match rows by an email
 * column, delete them, or blank the identifying columns and count what happened. Three copies is
 * three places to get `where` wrong, and the framework already carries the scar: a filter passed at
 * the top level instead of under `where` is IGNORED, and the query then matches the whole table. On
 * a delete path that is not a bug, it is an incident.
 *
 * The plugin still owns everything that is actually its business: which tables it has, which columns
 * are personal, and which strategies it can honour. This owns only the mechanics.
 */
export class PersonalDataRows {
  /** Recognisable as a tombstone, and not mistakable for a value somebody typed. */
  static readonly TOMBSTONE = '[erased]';

  constructor(private readonly db: any) {}

  /**
   * The subject's rows in `table`, matched on `emailColumn`.
   *
   * The filter goes under `where`, always. An empty email matches nothing and returns nothing —
   * never everything.
   */
  async find(table: string, emailColumn: string, subject: IPersonalDataSubjectRef): Promise<Record<string, any>[]> {
    const email = String(subject?.email ?? '').trim().toLowerCase();
    if (!email) return [];
    const rows = await this.db.find(table, { where: { [emailColumn]: email } });
    return Array.isArray(rows) ? rows : [];
  }

  /** Delete every matching row, one id at a time, and report how many actually went. */
  async deleteAll(table: string, emailColumn: string, subject: IPersonalDataSubjectRef, strategy: string): Promise<IPersonalDataRowsResult> {
    const rows = await this.find(table, emailColumn, subject);
    for (const row of rows) {
      await this.db.delete(table, { id: row.id });
    }
    return { strategy, erased: rows.length, anonymised: 0, retained: 0, remaining: 0 };
  }

  /**
   * Keep the rows, destroy the identifiers.
   *
   * `columns` maps a column to what replaces it: `TOMBSTONE` where something must remain readable,
   * `null` where the column should simply be emptied. Naming each column is deliberate — a helper
   * that guessed which fields were personal would be wrong the first time a plugin added one.
   */
  async anonymise(
    table: string,
    emailColumn: string,
    subject: IPersonalDataSubjectRef,
    strategy: string,
    columns: Record<string, string | null>,
  ): Promise<IPersonalDataRowsResult> {
    const rows = await this.find(table, emailColumn, subject);
    for (const row of rows) {
      await this.db.update(table, { id: row.id }, { ...columns });
    }
    return { strategy, erased: 0, anonymised: rows.length, retained: 0, remaining: 0 };
  }

  /** Nothing matched, or the strategy was `retain` and the rows stand. */
  static none(strategy: string, retainedReason?: string): IPersonalDataRowsResult {
    return { strategy, erased: 0, anonymised: 0, retained: retainedReason ? 1 : 0, remaining: 0, retainedReason };
  }
}
