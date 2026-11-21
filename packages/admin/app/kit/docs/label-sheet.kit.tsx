import { KitCopy } from '@/app/kit/kit-copy';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { QrCode } from '@/components/ui/view/qr-code.client';
import { LabelSheet } from '@/components/ui/label-sheet';
import type { ILabelSheetLayout } from '@/components/ui/interfaces/label-sheet-layout.interface';
import type { KitDoc } from '@/app/kit/kit-doc';

/** LabelSheet: labels printed on A4 the way label paper is laid out. */
export class LabelSheetKit {
  private static readonly CSS = '.l{display:flex;align-items:center;gap:3mm;height:100%}.l b{display:block;font-size:4mm}.l small{display:block;font-size:2.8mm;color:#444}';

  private static products(): string[] {
    const items = [['Cotton T-shirt', 'TS-001', '19.90 €'], ['Wool scarf', 'SC-014', '24.00 €'], ['Ceramic mug', 'MG-203', '9.50 €']];
    return Array.from({ length: 7 }, (_, i) => items[i % items.length]).map(([name, sku, price]) =>
      `<div class="l">${QrCode.svg(sku, '24mm')}<div><b>${LabelSheet.escape(name)}</b><small>${LabelSheet.escape(sku)}</small><small>${LabelSheet.escape(price)}</small></div></div>`);
  }

  private static preview(labels: string[], layout: ILabelSheetLayout): any {
    return <iframe title={KitCopy.t('docs.label-sheet.preview')} srcDoc={LabelSheet.html(labels, layout, '', `${LabelSheetKit.CSS}html{zoom:.5}`)} className="fc-kitdoc__sheet" />;
  }

  static doc(): KitDoc {
    const labels = LabelSheetKit.products();
    return {
      slug: 'label-sheet', name: 'LabelSheet', group: KitCopy.t('docs.small.data'),
      intro: KitCopy.t('docs.label-sheet.intro'),
      from: "import { LabelSheet, QrCode } from '@fromcode119/sdk/admin';",
      examples: [
        {
          title: KitCopy.t('docs.label-sheet.a4x24'), text: KitCopy.t('docs.label-sheet.a4x24Text'),
          demo: <div className="fc-kitdoc__stack">{LabelSheetKit.preview(labels, LabelSheet.LAYOUTS.a4x24)}<Button variant={ButtonVariant.SECONDARY} onClick={() => LabelSheet.print(labels, LabelSheet.LAYOUTS.a4x24, 'Labels', LabelSheetKit.CSS)}>{KitCopy.t('docs.label-sheet.print')}</Button></div>,
          code: "const labels = products.map((p) =>\n  `${QrCode.svg(p.sku, '24mm')}<b>${LabelSheet.escape(p.name)}</b>`);\nLabelSheet.print(labels, LabelSheet.LAYOUTS.a4x24, 'Product labels', css);",
        },
        { title: KitCopy.t('docs.label-sheet.a4x10'), text: KitCopy.t('docs.label-sheet.a4x10Text'), demo: LabelSheetKit.preview(labels.slice(0, 4), LabelSheet.LAYOUTS.a4x10), code: 'LabelSheet.print(labels, LabelSheet.LAYOUTS.a4x10, title, css);' },
        { title: KitCopy.t('docs.label-sheet.own'), text: KitCopy.t('docs.label-sheet.ownText'), demo: LabelSheetKit.preview(labels.slice(0, 6), { columns: 2, rows: 3, widthMm: 90, heightMm: 50, topMm: 10 }), code: 'LabelSheet.print(labels, { columns: 2, rows: 3, widthMm: 90, heightMm: 50, topMm: 10 });' },
      ],
      options: [
        { name: 'print(labels, layout, title?, css?)', type: 'void', does: KitCopy.t('docs.label-sheet.optPrint') },
        { name: 'html(labels, layout, title?, css?)', type: 'string', does: KitCopy.t('docs.label-sheet.optHtml') },
        { name: 'LAYOUTS', type: 'a4x24 | a4x10 | a4x1', does: KitCopy.t('docs.label-sheet.optLayouts') },
        { name: 'layout.columns, layout.rows', type: 'number', does: KitCopy.t('docs.label-sheet.optGrid') },
        { name: 'layout.widthMm, layout.heightMm', type: 'number', does: KitCopy.t('docs.label-sheet.optSize') },
        { name: 'layout.topMm', type: 'number', initial: '0', does: KitCopy.t('docs.label-sheet.optTop') },
        { name: 'layout.cutLines', type: 'boolean', initial: 'true', does: KitCopy.t('docs.label-sheet.optCut') },
        { name: 'escape(value)', type: 'string', does: KitCopy.t('docs.label-sheet.optEscape') },
      ],
    };
  }
}
