import type { ReactNode } from 'react';

import { Reactor, prop, state, bound } from '@fromcode119/react-class-components';
import { FrameworkIcons } from '@fromcode119/react';
import { RecordJsonView } from '@/components/collection/edit/view/record-json-view.client';
import { AdminI18n } from '@/lib/i18n/admin-i18n';

/**
 * The record as it is stored, at the foot of the record.
 *
 * It used to live behind a switch in the record's ⋯, which replaced the whole page with an editor —
 * so the only way to glance at the stored shape was to leave the record. The record pages this
 * console follows put it where it belongs: one line at the foot that says how many keys the record
 * holds, and opens over the page without taking it away.
 *
 * The count is the record's own keys, so it is a fact about this record and not about its schema.
 */
export class RecordJsonCard extends Reactor {
  @prop declare formData: Record<string, any>;
  @prop declare setFormData: (value: any) => void;
  @prop declare collectionSlug: string;
  @prop declare renderedFieldNames: string[];

  @state private open = false;

  @bound private show(): void { this.open = true; }
  @bound private hide(): void { this.open = false; }

  private get keyCount(): number {
    return Object.keys(this.formData ?? {}).length;
  }

  render(): ReactNode {
    return (
      <>
        <section className="fc-surface fc-record-card fc-record-json">
          <div className="fc-record-card__head">
            <h2 className="fc-record-card__title">
              {AdminI18n.t('collection.json.title')}
              <span className="fc-record-json__count">{AdminI18n.t('collection.json.keys', { count: this.keyCount })}</span>
            </h2>
            <button type="button" className="fc-record-card__menu" onClick={this.show} aria-label={AdminI18n.t('collection.json.open')} title={AdminI18n.t('collection.json.open')}>
              <FrameworkIcons.External size={16} />
            </button>
          </div>
        </section>

        {this.open ? (
          <div className="fc-sheet fc-sheet--json" role="dialog" aria-modal="true">
            <div className="fc-sheet__backdrop" onClick={this.hide} />
            <div className="fc-sheet__panel">
              <div className="fc-sheet__head">
                <div className="fc-sheet__heading">
                  <div className="fc-sheet__title">
                    {AdminI18n.t('collection.json.title')}
                    <span className="fc-record-json__count">{AdminI18n.t('collection.json.keys', { count: this.keyCount })}</span>
                  </div>
                </div>
                <button type="button" className="fc-sheet__close" onClick={this.hide} aria-label={AdminI18n.t('common.close')}>
                  <FrameworkIcons.Close size={16} />
                </button>
              </div>
              <div className="fc-sheet__body">
                <RecordJsonView
                  formData={this.formData}
                  setFormData={this.setFormData}
                  collectionSlug={this.collectionSlug}
                  renderedFieldNames={this.renderedFieldNames}
                />
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }
}
