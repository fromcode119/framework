import { KitCopy } from '@/app/kit/kit-copy';
import { Fragment } from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { RecordCard } from '@/components/ui/view/record-card.client';
import { StatCard } from '@/components/ui/view/stat-card.client';
import type { KitDoc } from '@/app/kit/kit-doc';

/**
 * The page pieces that are classes, not components: a screen writes the class on its own markup.
 * Each is shown here with the markup it expects, so a screen copies it instead of drawing its own.
 */
export class PagePiecesKit {
  private static readonly PICTURE = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#a1a1aa"/><circle cx="110" cy="80" r="28" fill="#e4e4e7"/><path d="M0 180 L120 100 L200 150 L250 120 L320 170 V180Z" fill="#71717a"/></svg>');

  private static readonly DAYS = [3, 8, 5, 12, 9, 4, 11];

  static doc(): KitDoc {
    return {
      slug: 'page-pieces', name: 'Page pieces (classes)', group: KitCopy.t('docs.page-pieces.layout'),
      intro: KitCopy.t('docs.page-pieces.smallPiecesAScreenWrites'),
      from: "/* Classes from the console's stylesheet — no import. */",
      examples: [
        {
          title: KitCopy.t('docs.page-pieces.fcPathWhereYouAre'),
          text: KitCopy.t('docs.page-pieces.stepsSeparatedByASlash'),
          demo: (
            <span className="fc-path">
              {['Library', 'Products', 'Spring 2026'].map((step, index, all) => (
                <Fragment key={step}>
                  {index ? <span className="fc-path__sep" aria-hidden="true">/</span> : null}
                  <button type="button" className="fc-path__step" aria-current={index === all.length - 1 ? 'page' : undefined}>{step}</button>
                </Fragment>
              ))}
            </span>
          ),
          code: '<span className="fc-path">\n  <button type="button" className="fc-path__step">Library</button>\n  <span className="fc-path__sep" aria-hidden="true">/</span>\n  <button type="button" className="fc-path__step" aria-current="page">Products</button>\n</span>',
        },
        {
          title: KitCopy.t('docs.page-pieces.fcFigureAndFcBars'),
          flush: true,
          text: KitCopy.t('docs.page-pieces.theFigureWithItsUnit'),
          demo: (
            <RecordCard title={KitCopy.t('docs.page-pieces.activity')}>
              <div className="fc-stack">
                <div className="fc-figure"><span className="fc-figure__value">52</span><span className="fc-figure__unit">{KitCopy.t('docs.page-pieces.events')}</span></div>
                <div className="fc-bars">
                  {PagePiecesKit.DAYS.map((count, index) => (
                    <div key={index} className="fc-bars__bar" title={`${count} events`} style={{ height: `${Math.round((count / 12) * 100)}%` }} />
                  ))}
                </div>
              </div>
            </RecordCard>
          ),
          code: '<div className="fc-figure">\n  <span className="fc-figure__value">52</span>\n  <span className="fc-figure__unit">events</span>\n</div>\n<div className="fc-bars">\n  <div className="fc-bars__bar" style={{ height: \'25%\' }} />\n  …\n</div>',
        },
        {
          title: KitCopy.t('docs.page-pieces.fcStatStripARow'),
          flush: true,
          text: KitCopy.t('docs.page-pieces.asManyStatcardSAs'),
          demo: <div className="fc-stat-strip fc-stat-strip--tight">{[['Files', '128'], ['Folders', '9'], ['Shared', '4'], ['Size', '312 MB']].map(([label, value]) => <StatCard key={label} title={label} value={value} />)}</div>,
          code: '<div className="fc-stat-strip fc-stat-strip--tight">\n  <StatCard title="Files" value="128" />\n  …\n</div>',
        },
        {
          title: KitCopy.t('docs.page-pieces.fcFileChipAFile'),
          demo: (
            <span className="fc-file-chip" title={KitCopy.t('docs.page-pieces.springCataloguePdf')}>
              <span className="fc-file-chip__picture"><FrameworkIcons.File size={14} /></span>
              <span className="fc-file-chip__name">spring-catalogue.pdf</span>
            </span>
          ),
          code: '<span className="fc-file-chip" title={name}>\n  <span className="fc-file-chip__picture"><img src={thumb} alt="" /></span>\n  <span className="fc-file-chip__name">{name}</span>\n</span>',
        },
        {
          title: KitCopy.t('docs.page-pieces.fcPreviewAPictureInside'),
          text: KitCopy.t('docs.page-pieces.centredOnAQuietGround'),
          demo: <div className="fc-preview fc-kitdoc__cell--wide"><img src={PagePiecesKit.PICTURE} alt={KitCopy.t('docs.page-pieces.aSamplePicture')} /></div>,
          code: '<div className="fc-preview"><img src={url} alt={alt} /></div>',
        },
        {
          title: KitCopy.t('docs.page-pieces.fcLinkALinkInside'),
          text: KitCopy.t('docs.page-pieces.underlinedInTheTextColour'),
          demo: <p className="fc-field-note">{KitCopy.t('docs.page-pieces.locationDataFrom')} <a className="fc-link" href="#kit">{KitCopy.t('docs.page-pieces.aPublicSource')}</a>{KitCopy.t('docs.page-pieces.underItsOwnLicence')}</p>,
          code: '<a className="fc-link" href={url}>a public source</a>',
        },
      ],
      options: [
        { name: 'fc-path__step[aria-current="page"]', type: 'class', does: KitCopy.t('docs.page-pieces.theStepYouAreOn') },
        { name: 'fc-stat-strip--tight', type: 'class', does: KitCopy.t('docs.page-pieces.fourToARowWith') },
      ],
    };
  }
}
