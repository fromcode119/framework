import type { IRecordsHubItem } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';

/**
 * The records other plugins hold about this one, asked for ONCE while a page draws: every card and every
 * place in a card (its head, body and menu) draws from the same answer. An answer is shared only for a
 * few seconds, so a page opened again later (back from making an invoice) asks afresh.
 */
export class RecordPartSource {
  private static readonly SHARED_MS = 5000;
  private static readonly asked = new Map<string, number>();
  private static readonly answers = new Map<string, Promise<{ items: IRecordsHubItem[]; actions: Array<{ id: string; label: string; href: string; icon?: string; part?: string }> }>>();

  static load(url: string, fresh = false): Promise<{ items: IRecordsHubItem[]; actions: Array<{ id: string; label: string; href: string; icon?: string; part?: string }> }> {
    const known = RecordPartSource.answers.get(url);
    if (known && !fresh && Date.now() - (RecordPartSource.asked.get(url) || 0) < RecordPartSource.SHARED_MS) return known;
    RecordPartSource.asked.set(url, Date.now());
    const answer = AdminApi.get(url).then((result: any) => ({
      items: Array.isArray(result?.items) ? result.items : [],
      actions: Array.isArray(result?.actions) ? result.actions : [],
    }));
    RecordPartSource.answers.set(url, answer);
    // A failed answer is not kept: the next card asks again.
    answer.catch(() => RecordPartSource.answers.delete(url));
    return answer;
  }
}
