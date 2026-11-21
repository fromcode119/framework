import { KitCopy } from '@/app/kit/kit-copy';
import { QrCode } from '@/components/ui/view/qr-code.client';
import type { KitDoc } from '@/app/kit/kit-doc';

/** QrCode: a value drawn as a QR code, on screen or on a printed label. */
export class QrCodeKit {
  static doc(): KitDoc {
    const link = 'https://shop.example/admin/products/1042';
    return {
      slug: 'qr-code', name: 'QrCode', group: KitCopy.t('docs.small.data'),
      intro: KitCopy.t('docs.qr-code.intro'),
      from: "import { QrCode } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.qr-code.aLink'), text: KitCopy.t('docs.qr-code.aLinkText'), demo: <QrCode value={link} />, code: '<QrCode value={productUrl} />' },
        { title: KitCopy.t('docs.qr-code.withCaption'), text: KitCopy.t('docs.qr-code.withCaptionText'), demo: <QrCode value="BOX-007" size={112} caption={KitCopy.t('docs.qr-code.box')} />, code: '<QrCode value="BOX-007" size={112} caption="Box BOX-007" />' },
        { title: KitCopy.t('docs.qr-code.sizes'), demo: <span className="fc-kitdoc__inline"><QrCode value="SKU-TS-001" size={64} /><QrCode value="SKU-TS-001" size={96} /><QrCode value="SKU-TS-001" size={160} /></span>, code: '<QrCode value={sku} size={64} />\n<QrCode value={sku} size={160} />' },
        { title: KitCopy.t('docs.qr-code.forPrint'), text: KitCopy.t('docs.qr-code.forPrintText'), demo: <code>QrCode.svg(value, '30mm')</code>, code: "const markup = QrCode.svg(boxUrl, '30mm');\n// put it into the printed page" },
        { title: KitCopy.t('docs.qr-code.empty'), text: KitCopy.t('docs.qr-code.emptyText'), demo: <span className="fc-field-note">—<QrCode value="" /></span>, code: '<QrCode value="" /> // renders nothing' },
      ],
      options: [
        { name: 'value', type: 'string', does: KitCopy.t('docs.qr-code.optValue') },
        { name: 'size', type: 'number', initial: '128', does: KitCopy.t('docs.qr-code.optSize') },
        { name: 'caption', type: 'ReactNode', does: KitCopy.t('docs.qr-code.optCaption') },
        { name: 'title', type: 'string', does: KitCopy.t('docs.qr-code.optTitle') },
        { name: 'className', type: 'string', does: KitCopy.t('docs.qr-code.optClass') },
        { name: 'QrCode.svg(value, size)', type: '(string, string) => string', does: KitCopy.t('docs.qr-code.optSvg') },
      ],
    };
  }
}
