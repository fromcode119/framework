import { KitCopy } from '@/app/kit/kit-copy';
import { RecordSummaryRow } from '@/components/ui/view/record-summary-row.client';
import { AdminFactGrid } from '@/components/ui/view/admin-fact-grid.client';
import { StructuredReadOnlyField } from '@/components/collection/fields/view/structured-read-only-field.client';
import type { KitDoc } from '@/app/kit/kit-doc';

/** RecordSummaryRow: a record too big for a card, told as one row that opens a drawer. */
export class RecordSummaryRowKit {
  private static facts() {
    return [
      { key: 'email', label: KitCopy.t('docs.record-summary-row.email'), value: 'eliza@example.com' },
      { key: 'cart', label: KitCopy.t('docs.record-summary-row.cart'), value: '81' },
      { key: 'amount', label: KitCopy.t('docs.record-summary-row.amount'), value: '4,60 €' },
    ];
  }

  /** A stored object of the size that used to spill: 16 values, three of them nested. */
  private static record(): Record<string, unknown> {
    return {
      email: 'eliza@example.com', fullName: 'Eliza Ivanova', cartId: 81, payableAmount: 4.6, paymentProviderKey: 'cash_on_delivery',
      notifyShop: true, notifyCustomer: true, walletAppliedAmount: 0, giftCardAppliedAmount: 0, reservationReference: 'CHK-1795086206356',
      quote: { subtotal: 3.83, tax: 0.77, total: 4.6 }, customer: { id: 9, kind: 'guest' }, hasSourceCart: true,
    };
  }

  private static labels(): Record<string, string> {
    return {
      email: KitCopy.t('docs.record-summary-row.email'), fullName: KitCopy.t('docs.record-summary-row.name'), cartId: KitCopy.t('docs.record-summary-row.cart'),
      payableAmount: KitCopy.t('docs.record-summary-row.amount'), paymentProviderKey: KitCopy.t('docs.record-summary-row.method'),
      notifyShop: KitCopy.t('docs.record-summary-row.notifyShop'), notifyCustomer: KitCopy.t('docs.record-summary-row.notifyCustomer'),
      quote: KitCopy.t('docs.record-summary-row.quote'), customer: KitCopy.t('docs.record-summary-row.customer'),
    };
  }

  static doc(): KitDoc {
    const row = KitCopy.t('docs.record-summary-row.title');
    return {
      slug: 'record-summary-row', name: 'RecordSummaryRow', group: KitCopy.t('docs.small.data'),
      intro: KitCopy.t('docs.record-summary-row.intro'),
      from: "import { RecordSummaryRow } from '@fromcode119/sdk/admin';",
      examples: [
        {
          title: KitCopy.t('docs.record-summary-row.basic'), text: KitCopy.t('docs.record-summary-row.basicText'), flush: true,
          demo: <RecordSummaryRow title={row} rowText="16 values" countLabel="16 values" hint={KitCopy.t('docs.record-summary-row.hint')}><AdminFactGrid facts={RecordSummaryRowKit.facts()} /></RecordSummaryRow>,
          code: '<RecordSummaryRow title="Order record" rowText="16 values" countLabel="16 values" hint="Customer · Cart · Payment">\n  <AdminFactGrid facts={facts} />\n</RecordSummaryRow>',
        },
        {
          title: KitCopy.t('docs.record-summary-row.named'), text: KitCopy.t('docs.record-summary-row.namedText'), flush: true,
          demo: <RecordSummaryRow title={row} countLabel="16 values" hint={KitCopy.t('docs.record-summary-row.hint')}><AdminFactGrid facts={RecordSummaryRowKit.facts()} /></RecordSummaryRow>,
          code: '<RecordSummaryRow title="Order record" countLabel="16 values" hint="Customer · Cart · Payment">…</RecordSummaryRow>',
        },
        {
          title: KitCopy.t('docs.record-summary-row.automatic'), text: KitCopy.t('docs.record-summary-row.automaticText'), flush: true,
          demo: <StructuredReadOnlyField value={RecordSummaryRowKit.record()} field={{ label: row, admin: { keyLabels: RecordSummaryRowKit.labels() } }} />,
          code: "{ name: 'data', type: 'json', admin: { readOnly: true, component: 'StructuredReadOnlyField' } }\n// the plugin's dictionary: fields.data.keyLabels = { cartId: 'Cart №', … }",
        },
        {
          title: KitCopy.t('docs.record-summary-row.unnamed'), text: KitCopy.t('docs.record-summary-row.unnamedText'), flush: true,
          demo: <StructuredReadOnlyField value={RecordSummaryRowKit.record()} field={{ label: row, admin: {} }} />,
          code: '// no keyLabels: every key is drawn under its own name, humanised — nothing is hidden',
        },
        {
          title: KitCopy.t('docs.record-summary-row.small'), text: KitCopy.t('docs.record-summary-row.smallText'), flush: true,
          demo: <StructuredReadOnlyField value={{ email: 'eliza@example.com', cartId: 81, payableAmount: 4.6 }} field={{ label: row, admin: { keyLabels: RecordSummaryRowKit.labels() } }} />,
          code: '// 12 values or fewer: the rows stay in the card',
        },
      ],
      options: [
        { name: 'title', type: 'string', does: KitCopy.t('docs.record-summary-row.optTitle') },
        { name: 'rowText', type: 'string', does: KitCopy.t('docs.record-summary-row.optRowText') },
        { name: 'countLabel', type: 'string', does: KitCopy.t('docs.record-summary-row.optCountLabel') },
        { name: 'count', type: 'number', does: KitCopy.t('docs.record-summary-row.optCount') },
        { name: 'hint', type: 'ReactNode', does: KitCopy.t('docs.record-summary-row.optHint') },
        { name: 'subtitle', type: 'ReactNode', initial: 'countLabel', does: KitCopy.t('docs.record-summary-row.optSubtitle') },
        { name: 'children', type: 'ReactNode', does: KitCopy.t('docs.record-summary-row.optChildren') },
        { name: 'openLabel', type: 'string', initial: 'title', does: KitCopy.t('docs.record-summary-row.optOpenLabel') },
        { name: 'className', type: 'string', does: KitCopy.t('docs.record-summary-row.optClass') },
      ],
    };
  }
}
