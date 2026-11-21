import { KitCopy } from '@/app/kit/kit-copy';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { ScanDialog } from '@/components/ui/view/scan-dialog.client';
import { SearchField } from '@/components/ui/view/search-field.client';
import type { KitDoc } from '@/app/kit/kit-doc';

/** ScanDialog: the camera reads a barcode or QR code; also the scan button of SearchField. */
export class ScanKit {
  static doc(): KitDoc {
    return {
      slug: 'scan-dialog', name: 'ScanDialog', group: KitCopy.t('docs.small.data'),
      intro: KitCopy.t('docs.scan.intro'),
      from: "import { ScanDialog, SearchField } from '@fromcode119/sdk/admin';",
      examples: [
        {
          title: KitCopy.t('docs.scan.dialog'), text: KitCopy.t('docs.scan.dialogText'),
          demo: (
            <KitPlay initial={{ open: false, code: '' }}>
              {(value, set) => (
                <span className="fc-kitdoc__inline">
                  <Button variant={ButtonVariant.SECONDARY} onClick={() => set({ ...value, open: true })}>{KitCopy.t('docs.scan.scan')}</Button>
                  <span className="fc-field-note">{value.code ? `${KitCopy.t('docs.scan.read')} ${value.code}` : KitCopy.t('docs.scan.nothingYet')}</span>
                  <ScanDialog isOpen={value.open} onClose={() => set({ ...value, open: false })} onResult={(code: string) => set({ open: false, code })} />
                </span>
              )}
            </KitPlay>
          ),
          code: '<ScanDialog isOpen={open} onClose={close}\n  onResult={(code) => { close(); find(code); }} />',
        },
        {
          title: KitCopy.t('docs.scan.inSearch'), text: KitCopy.t('docs.scan.inSearchText'),
          demo: <div className="fc-kitdoc__cell"><KitPlay initial="">{(value, set) => <SearchField value={value} onChange={set} onScan={() => undefined} placeholder={KitCopy.t('docs.scan.searchProducts')} />}</KitPlay></div>,
          code: '<SearchField value={query} onChange={setQuery}\n  onScan={(code) => openProductByCode(code)} placeholder="Search products" />',
        },
        {
          title: KitCopy.t('docs.scan.ownTitle'), text: KitCopy.t('docs.scan.ownTitleText'),
          demo: <KitPlay initial={false}>{(open, set) => <><Button variant={ButtonVariant.SECONDARY} onClick={() => set(true)}>{KitCopy.t('docs.scan.scanBox')}</Button><ScanDialog isOpen={Boolean(open)} onClose={() => set(false)} onResult={() => set(false)} title={KitCopy.t('docs.scan.scanBox')} description={KitCopy.t('docs.scan.scanBoxText')} /></>}</KitPlay>,
          code: '<ScanDialog isOpen={open} onClose={close} onResult={openBox}\n  title="Scan a box" description="The QR code on the box label." />',
        },
      ],
      options: [
        { name: 'isOpen, onClose', type: 'boolean, () => void', does: KitCopy.t('docs.scan.optOpen') },
        { name: 'onResult', type: '(code: string) => void', does: KitCopy.t('docs.scan.optResult') },
        { name: 'title', type: 'string', does: KitCopy.t('docs.scan.optTitle') },
        { name: 'description', type: 'ReactNode', does: KitCopy.t('docs.scan.optDescription') },
        { name: 'SearchField onScan', type: '(code: string) => void', does: KitCopy.t('docs.scan.optOnScan') },
      ],
    };
  }
}
