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
      slug: 'page-pieces', name: 'Page pieces (classes)', group: 'Layout',
      intro: 'Small pieces a screen writes as a class on its own markup: a folder path, a big figure with its bars, a row of stat cards, a file chip, a picture preview, a link in running text.',
      from: "/* Classes from the console's stylesheet — no import. */",
      examples: [
        {
          title: 'fc-path — where you are',
          text: 'Steps separated by a slash; the current one is `aria-current="page"` and is not a link.',
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
          title: 'fc-figure and fc-bars — one number and its days',
          flush: true,
          text: 'The figure with its unit, and a bar per day; each bar is its share of the highest day, as `height`.',
          demo: (
            <RecordCard title="Activity">
              <div className="fc-stack">
                <div className="fc-figure"><span className="fc-figure__value">52</span><span className="fc-figure__unit">events</span></div>
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
          title: 'fc-stat-strip — a row of figures',
          flush: true,
          text: 'As many `StatCard`s as fit, each at least 120px. `fc-stat-strip--tight` is four to a row, two on a phone.',
          demo: <div className="fc-stat-strip fc-stat-strip--tight">{[['Files', '128'], ['Folders', '9'], ['Shared', '4'], ['Size', '312 MB']].map(([label, value]) => <StatCard key={label} title={label} value={value} />)}</div>,
          code: '<div className="fc-stat-strip fc-stat-strip--tight">\n  <StatCard title="Files" value="128" />\n  …\n</div>',
        },
        {
          title: 'fc-file-chip — a file named in a line',
          demo: (
            <span className="fc-file-chip" title="spring-catalogue.pdf">
              <span className="fc-file-chip__picture"><FrameworkIcons.File size={14} /></span>
              <span className="fc-file-chip__name">spring-catalogue.pdf</span>
            </span>
          ),
          code: '<span className="fc-file-chip" title={name}>\n  <span className="fc-file-chip__picture"><img src={thumb} alt="" /></span>\n  <span className="fc-file-chip__name">{name}</span>\n</span>',
        },
        {
          title: 'fc-preview — a picture inside a card or a sheet',
          text: 'Centred on a quiet ground, at most 200px high, never cropped.',
          demo: <div className="fc-preview fc-kitdoc__cell--wide"><img src={PagePiecesKit.PICTURE} alt="A sample picture" /></div>,
          code: '<div className="fc-preview"><img src={url} alt={alt} /></div>',
        },
        {
          title: 'fc-link — a link inside running text',
          text: 'Underlined in the text colour; a link that is an action is a `Button` instead.',
          demo: <p className="fc-field-note">Location data from <a className="fc-link" href="#kit">a public source</a>, under its own licence.</p>,
          code: '<a className="fc-link" href={url}>a public source</a>',
        },
      ],
      options: [
        { name: 'fc-path__step[aria-current="page"]', type: 'class', does: 'The step you are on: stronger, not clickable.' },
        { name: 'fc-stat-strip--tight', type: 'class', does: 'Four to a row with 8px between, two on a phone.' },
      ],
    };
  }
}
