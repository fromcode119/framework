import type { ReactNode } from 'react';
import { ThemeMode } from '@fromcode119/core/client';
import { PureReactor, prop } from '@fromcode119/react-class-components';
import { RecordsHub } from '@fromcode119/react';
import type { IRecordsHubItem } from '@fromcode119/react';
import { AdminApi } from '@/lib/api';
import { AdminConstants } from '@/lib/constants/admin.constants';
import { RecordsHubOpenItem } from '@/lib/records-hub-open-item';

/**
 * "What else relates to this record?" — the panel an order, a client or a subscription gets once its
 * collection declares `admin.recordLinks`.
 *
 * The admin knows nothing about what it is showing. It reads the correlation keys the collection
 * declared, takes their values off the record in front of it, and asks the framework; whichever plugins
 * said they understand one of those key names answer. That is the whole point: a payment, an invoice, a
 * shipment and a scheduled job land on one screen without the admin — or any of those plugins — being
 * told what an order is.
 */
export class CollectionRecordLinksPanel extends PureReactor {
  @prop declare collection: any;
  @prop declare formData: Record<string, any>;
  @prop declare recordId: string;
  @prop declare theme: ThemeMode;
  @prop declare navigate?: (href: string) => void;

  private get declaration(): { kind: string; keys: Record<string, string>; title?: string; emptyHint?: string } | null {
    const declared = this.collection?.admin?.recordLinks;
    const kind = String(declared?.kind || '').trim();
    return kind && declared?.keys && typeof declared.keys === 'object' ? { ...declared, kind } : null;
  }

  /**
   * The declared keys resolved against THIS record. A key whose field is empty is left out rather than
   * sent blank — a provider matching on an empty value would answer for every record there is.
   */
  private get keys(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [keyName, fieldName] of Object.entries(this.declaration?.keys ?? {})) {
      const value = String(this.formData?.[String(fieldName)] ?? '').trim();
      if (value) out[String(keyName)] = value;
    }
    return out;
  }

  render(): ReactNode {
    const declaration = this.declaration;
    const keys = this.keys;
    // Nothing to correlate on is not an empty result — there is no question to ask yet.
    if (!declaration || !Object.keys(keys).length) return null;
    return (
      <div className="mt-6">
        <RecordsHub
          theme={this.theme}
          title={declaration.title || 'Related records'}
          emptyHint={declaration.emptyHint || 'No other plugin holds a record linked to this one yet.'}
          reloadKey={`${declaration.kind}:${this.recordId}:${Object.values(keys).join('|')}`}
          load={() => AdminApi.get(AdminConstants.ENDPOINTS.SYSTEM.RECORD_LINKS(declaration.kind, this.recordId, keys))}
          onOpenItem={(item: IRecordsHubItem) => RecordsHubOpenItem.open(item, this.navigate)}
          onDownloadItem={(item: IRecordsHubItem) => void RecordsHubOpenItem.download(item, this.navigate)}
        />
      </div>
    );
  }
}
