import { KitCopy } from '@/app/kit/kit-copy';
import { PartsLine } from '@/components/ui/view/parts-line.client';
import type { KitDoc } from '@/app/kit/kit-doc';

/** PartsLine: a whole told as its parts on one quiet line. */
export class PartsLineKit {
  private static sources() {
    return [
      { key: '1', label: KitCopy.t('docs.parts-line.sofia'), detail: 'A-03-2', count: 6, href: '#' },
      { key: '2', label: KitCopy.t('docs.parts-line.bucharest'), detail: 'B-01', count: 2, href: '#' },
    ];
  }

  static doc(): KitDoc {
    const sources = PartsLineKit.sources();
    return {
      slug: 'parts-line', name: 'PartsLine', group: KitCopy.t('docs.small.data'),
      intro: KitCopy.t('docs.parts-line.intro'),
      from: "import { PartsLine } from '@fromcode119/sdk/admin';",
      examples: [
        { title: KitCopy.t('docs.parts-line.oneSource'), text: KitCopy.t('docs.parts-line.oneSourceText'), demo: <PartsLine caption={KitCopy.t('docs.parts-line.from')} parts={sources.slice(0, 1)} />, code: '<PartsLine caption="From" parts={[{ key: \'1\', label: \'Sofia\', detail: \'A-03-2\', count: 6, href }]} />' },
        { title: KitCopy.t('docs.parts-line.severalSources'), demo: <PartsLine caption={KitCopy.t('docs.parts-line.from')} parts={sources} />, code: '<PartsLine caption="From" parts={[\n  { key: \'1\', label: \'Sofia\', detail: \'A-03-2\', count: 6, href },\n  { key: \'2\', label: \'Bucharest\', detail: \'B-01\', count: 2, href },\n]} />' },
        { title: KitCopy.t('docs.parts-line.noDetail'), text: KitCopy.t('docs.parts-line.noDetailText'), demo: <PartsLine caption={KitCopy.t('docs.parts-line.from')} parts={[sources[0], { key: '2', label: KitCopy.t('docs.parts-line.bucharest'), count: 2 }]} />, code: '<PartsLine caption="From" parts={[{ key: \'2\', label: \'Bucharest\', count: 2 }]} />' },
        { title: KitCopy.t('docs.parts-line.noCaption'), demo: <PartsLine parts={sources.map((part) => ({ ...part, href: undefined }))} />, code: '<PartsLine parts={parts} />' },
        { title: KitCopy.t('docs.parts-line.inALine'), text: KitCopy.t('docs.parts-line.inALineText'), demo: <span className="fc-kitdoc__stack"><span>{KitCopy.t('docs.parts-line.mug')} · 8×</span><PartsLine caption={KitCopy.t('docs.parts-line.from')} parts={sources} /></span>, code: '<span>Mug · 8×</span>\n<PartsLine caption="From" parts={parts} />' },
      ],
      options: [
        { name: 'parts', type: 'IPartsLinePart[]', does: KitCopy.t('docs.parts-line.optParts') },
        { name: 'parts[].label', type: 'ReactNode', does: KitCopy.t('docs.parts-line.optLabel') },
        { name: 'parts[].detail', type: 'ReactNode', does: KitCopy.t('docs.parts-line.optDetail') },
        { name: 'parts[].count', type: 'number', does: KitCopy.t('docs.parts-line.optCount') },
        { name: 'parts[].href', type: 'string', does: KitCopy.t('docs.parts-line.optHref') },
        { name: 'caption', type: 'ReactNode', does: KitCopy.t('docs.parts-line.optCaption') },
        { name: 'className', type: 'string', does: KitCopy.t('docs.parts-line.optClass') },
      ],
    };
  }
}
