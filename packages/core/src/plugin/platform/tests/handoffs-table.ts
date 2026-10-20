/**
 * An in-memory handoffs table with the real table's primary key (nonce) and unique handoff hash. Reads
 * return copies, as a database does: a row read before an update keeps what it read.
 */
export class HandoffsTable {
  rows: Array<Record<string, any>> = [];
  private matches = (row: Record<string, any>, where: Record<string, any>) => Object.entries(where).every(([k, v]) => row[k] === v);
  async findOne(_table: string, where: Record<string, any>) { const row = this.rows.find((r) => this.matches(r, where)); return row ? { ...row } : null; }
  async find(_table: string, query: { where: Record<string, any> }) { return this.rows.filter((row) => this.matches(row, query.where)).map((row) => ({ ...row })); }
  async insert(_table: string, row: Record<string, any>) {
    if (this.rows.some((r) => r.nonce === row.nonce || (row.handoff_hash && r.handoff_hash === row.handoff_hash))) throw new Error('unique violation');
    this.rows.push({ ...row });
    return row;
  }
  async update(_table: string, where: Record<string, any>, values: Record<string, any>) {
    const row = this.rows.find((r) => this.matches(r, where));
    if (!row) return null;
    Object.assign(row, values);
    return { ...row };
  }
  async delete(_table: string, where: Record<string, any>) { this.rows = this.rows.filter((row) => !this.matches(row, where)); }
}
