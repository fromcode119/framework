import type { IRecordsHubItem } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import type { IRecordPartAction } from '@/components/collection/edit/interfaces/record-part-action.interface';

/**
 * The records other plugins hold about this one, asked for ONCE while a page draws: every card and every
 * place in a card (its head, body and menu) draws from the same answer. An answer is shared only for a
 * few seconds, so a page opened again later (back from making an invoice) asks afresh.
 */
export class RecordPartSource {
  private static readonly SHARED_MS = 5000;
  private static readonly asked = new Map<string, number>();
  private static readonly answers = new Map<string, Promise<{ items: IRecordsHubItem[]; actions: IRecordPartAction[] }>>();

  /** `reads`: the record was read again after a write, so an answer to the earlier reading is not shared. */
  static load(url: string, fresh = false, reads = 0): Promise<{ items: IRecordsHubItem[]; actions: IRecordPartAction[] }> {
    const key = `${url}#${reads}`;
    const known = RecordPartSource.answers.get(key);
    if (known && !fresh && Date.now() - (RecordPartSource.asked.get(key) || 0) < RecordPartSource.SHARED_MS) return known;
    RecordPartSource.asked.set(key, Date.now());
    const answer = AdminApi.get(url).then((result: any) => ({
      items: Array.isArray(result?.items) ? result.items : [],
      actions: Array.isArray(result?.actions) ? result.actions : [],
    }));
    RecordPartSource.answers.set(key, answer);
    // A failed answer is not kept: the next card asks again.
    answer.catch(() => RecordPartSource.answers.delete(key));
    return answer;
  }
}
