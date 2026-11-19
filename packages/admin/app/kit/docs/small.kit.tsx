import { FrameworkIcons } from '@fromcode119/react';
import { Kbd } from '@/components/ui/view/kbd.client';
import { Divider } from '@/components/ui/view/divider.client';
import { Skeleton } from '@/components/ui/view/skeleton.client';
import { ProgressBar } from '@/components/ui/view/progress-bar.client';
import { ScreenshotGallery } from '@/components/ui/view/screenshot-gallery.client';
import { Tile } from '@/components/ui/view/tile.client';
import { Badge } from '@/components/ui/view/badge.client';
import { BadgeVariant } from '@/components/ui/enums/badge-variant.enum';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import { Loader } from '@/components/ui/view/loader.client';
import { CopyValue } from '@/components/ui/view/copy-value.client';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { KitDoc } from '@/app/kit/kit-doc';

/** The small pieces: each has few options, so each page is short. */
export class SmallKit {
  static tileMenu(): any[] {
    return [{ label: 'Details', onClick: () => undefined }, { label: 'Move to folder', onClick: () => undefined }];
  }

  /** Four flat pictures drawn in place, so the example needs no file. */
  static pictures(): string[] {
    return ['#3f3f46', '#0f766e', '#7c3aed', '#b45309'].map((fill) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="${fill}"/></svg>`)}`);
  }

  static docs(): KitDoc[] {
    return [
      {
        slug: 'kbd', name: 'Kbd', group: 'Data',
        intro: 'A key, or keys, to press.',
        from: "import { Kbd } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'One key and a chord', demo: <><Kbd>⌘K</Kbd><Kbd>Esc</Kbd><span className="fc-kitdoc__inline"><Kbd>G</Kbd><Kbd>P</Kbd></span></>, code: '<Kbd>⌘K</Kbd>\n<Kbd>Esc</Kbd>' },
        ],
        options: [{ name: 'children', type: 'ReactNode', does: 'The key as it is printed on a keyboard.' }],
      },
      {
        slug: 'divider', name: 'Divider', group: 'Layout',
        intro: 'A hairline between two things that belong to one whole.',
        from: "import { Divider } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Horizontal', demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><Divider /><Divider variant="dashed" /></div>, code: '<Divider />\n<Divider variant="dashed" />' },
          { title: 'Vertical', text: 'Between controls on one line; it takes the line’s height.', demo: <span className="fc-kitdoc__inline fc-kitdoc__tall"><span>Export</span><Divider orientation="vertical" /><span>Import</span></span>, code: '<Divider orientation="vertical" />' },
        ],
        options: [
          { name: 'orientation', type: "'horizontal' | 'vertical'", initial: 'horizontal', does: 'Which way it runs.' },
          { name: 'variant', type: "'solid' | 'dashed'", initial: 'solid', does: 'The line.' },
        ],
      },
      {
        slug: 'skeleton', name: 'Skeleton', group: 'Feedback',
        intro: 'The shape of what is still loading, so the page does not jump when it arrives.',
        from: "import { Skeleton } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Lines', demo: <div className="fc-kitdoc__stack fc-kitdoc__cell"><Skeleton height={12} width="80%" /><Skeleton height={12} width="60%" /><Skeleton height={12} width="40%" /></div>, code: '<Skeleton height={12} width="80%" />\n<Skeleton height={12} width="60%" />' },
          { title: 'A row with a picture', demo: <div className="fc-kit__skeleton fc-kitdoc__cell"><Skeleton width={32} height={32} round /><div className="fc-kit__skeleton-lines"><Skeleton height={12} width="70%" /><Skeleton height={12} width="40%" /></div></div>, code: '<Skeleton width={32} height={32} round />\n<Skeleton height={12} width="70%" />' },
        ],
        options: [
          { name: 'width, height', type: 'number | string', does: 'Its size; a number is pixels.' },
          { name: 'round', type: 'boolean', initial: 'false', does: 'A circle, for a picture.' },
        ],
      },
      {
        slug: 'progress-bar', name: 'ProgressBar', group: 'Feedback',
        intro: 'How far something that takes a while has got: a download, an upload, an import.',
        from: "import { ProgressBar } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'With a known length', demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><ProgressBar value={12} /><ProgressBar value={64} label="Downloading the archive" detail="9 of 14 MB" /><ProgressBar value={100} label="Done" detail="14 MB" /></div>, code: '<ProgressBar value={64} label="Downloading the archive" detail="9 of 14 MB" />' },
          { title: 'A figure that is high', text: 'For a measure rather than a wait: the tone says it needs looking at.', demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><ProgressBar value={78} tone="warning" label="Disk" detail="78%" /><ProgressBar value={94} tone="danger" label="Memory" detail="94%" /></div>, code: '<ProgressBar value={94} tone="danger" label="Memory" detail="94%" />' },
          { title: 'Length not known', text: 'Without a value the bar runs on its own: it says only that the thing is going.', demo: <div className="fc-kitdoc__cell--wide"><ProgressBar label="Preparing the archive" /></div>, code: '<ProgressBar label="Preparing the archive" />' },
        ],
        options: [
          { name: 'value', type: 'number | null', does: '0–100; left out when the length is not known.' },
          { name: 'label', type: 'ReactNode', does: 'What is going on.' },
          { name: 'detail', type: 'ReactNode', does: 'How far, in the caller’s words.' },
          { name: 'tone', type: "'warning' | 'danger'", does: 'Says the figure is high: a disk nearly full, a limit nearly reached.' },
        ],
      },
      {
        slug: 'tile', name: 'Tile', group: 'Data',
        intro: 'One thing shown by its picture: a file, a folder. Pressing the picture opens it; everything that can be done with it is in its menu, so nothing waits for a pointer to hover.',
        from: "import { Tile } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'A picture, a file without one, a folder', text: 'They stand in `fc-tile-grid`, which fits as many as the width holds.', demo: <div className="fc-tile-grid fc-kitdoc__cell--wide"><KitPlay initial={true}>{(value, set) => <Tile title="hero.jpg" facts="117 KB · JPEG" picture={SmallKit.pictures()[1]} marks={<Badge variant={BadgeVariant.SUCCESS}>WebP</Badge>} selected={value} onSelect={() => set(!value)} menu={SmallKit.tileMenu()} onOpen={() => undefined} openLabel="Open hero.jpg" />}</KitPlay><Tile title="price-list.pdf" facts="352 KB · PDF" icon={<FrameworkIcons.File size={40} />} onSelect={() => undefined} menu={SmallKit.tileMenu()} onOpen={() => undefined} openLabel="Open price-list.pdf" /><Tile title="Products" facts="Folder" icon={<FrameworkIcons.Folder size={40} />} menu={SmallKit.tileMenu()} onOpen={() => undefined} openLabel="Products" /></div>, code: '<div className="fc-tile-grid">\n  <Tile title="hero.jpg" facts="117 KB · JPEG" picture={url}\n    marks={<Badge variant={BadgeVariant.SUCCESS}>WebP</Badge>}\n    selected={chosen} onSelect={toggle}\n    menu={[{ label: \'Details\', onClick }, { label: \'Delete\', variant: DropdownItemVariant.DANGER, onClick }]}\n    onOpen={open} openLabel="Open hero.jpg" />\n</div>' },
        ],
        options: [
          { name: 'title', type: 'string', does: 'The thing’s name, cut with an ellipsis when it is longer than the tile.' },
          { name: 'facts', type: 'string', does: 'One quiet line under the name.' },
          { name: 'picture', type: 'string', does: 'The picture’s address; without one the icon stands in its place.' },
          { name: 'icon', type: 'ReactNode', does: 'Drawn when there is no picture.' },
          { name: 'marks', type: 'ReactNode', does: 'Badges on the picture: what the thing is marked as.' },
          { name: 'selected', type: 'boolean', does: 'Chosen: the tile is outlined and its tick stays.' },
          { name: 'onSelect', type: '() => void', does: 'Given, the tile carries a tick.' },
          { name: 'menu', type: 'IDropdownItem[]', does: 'What can be done with the thing.' },
          { name: 'onOpen', type: '() => void', does: 'The picture was pressed.' },
          { name: 'openLabel', type: 'string', does: 'What pressing the picture does, for a reader who cannot see it.' },
        ],
      },
      {
        slug: 'screenshot-gallery', name: 'ScreenshotGallery', group: 'Data',
        intro: 'The pictures of one thing as a card: the chosen one large, the rest in a strip under it. With no pictures the card is not drawn.',
        from: "import { ScreenshotGallery } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Several pictures', text: 'A small picture makes it the large one; the large one asks the page to open it full size.', demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={0}>{(value, set) => <ScreenshotGallery title="Screens" images={SmallKit.pictures()} active={value} alt="Storefront" onSelect={set} />}</KitPlay></div>, code: '<ScreenshotGallery title="Screens" images={urls} active={index} alt={name}\n  onSelect={setIndex} onOpen={openFullSize} />' },
          { title: 'One picture', text: 'No strip: there is nothing to choose between.', demo: <div className="fc-kitdoc__cell--wide"><ScreenshotGallery title="Screens" images={SmallKit.pictures().slice(0, 1)} active={0} alt="Storefront" onSelect={() => undefined} /></div>, code: '<ScreenshotGallery title="Screens" images={[url]} active={0} alt={name} onSelect={setIndex} />' },
        ],
        options: [
          { name: 'title', type: 'string', does: 'The card’s name.' },
          { name: 'images', type: 'string[]', does: 'The pictures’ addresses, in order.' },
          { name: 'active', type: 'number', does: 'Which picture is large.' },
          { name: 'alt', type: 'string', does: 'What the pictures show, for a reader who cannot see them.' },
          { name: 'onSelect', type: '(index: number) => void', does: 'A small picture was pressed.' },
          { name: 'onOpen', type: '() => void', does: 'The large picture was pressed; the page owns the full-size view.' },
        ],
      },
      {
        slug: 'loader', name: 'Loader', group: 'Feedback',
        intro: 'A spinner with a word, for a wait with no shape to draw.',
        from: "import { Loader } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'With and without words', demo: <><Loader label="Loading" /><Loader /></>, code: '<Loader label="Loading" />\n<Loader />' },
        ],
        options: [
          { name: 'label', type: 'string', does: 'What is being waited for.' },
          { name: 'fullPage', type: 'boolean', initial: 'false', does: 'Centred in the whole page.' },
        ],
      },
      {
        slug: 'copy-value', name: 'CopyValue', group: 'Data',
        intro: 'A value someone copies elsewhere — an id, an email, a tracking number — with a copy button after it.',
        from: "import { CopyValue } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'The value itself', demo: <CopyValue value="prod_01M7R4CRJEHHPTTF1KVTJXKCEE" />, code: '<CopyValue value="prod_01M7R4CRJEHHPTTF1KVTJXKCEE" />' },
          { title: 'Showing something else', text: '`children` is what is shown; `value` is what is copied.', demo: <CopyValue value="maria@example.com"><a href="mailto:maria@example.com">Maria Petrova</a></CopyValue>, code: '<CopyValue value="maria@example.com">\n  <a href="mailto:maria@example.com">Maria Petrova</a>\n</CopyValue>' },
        ],
        options: [
          { name: 'value', type: 'string', does: 'What lands on the clipboard.' },
          { name: 'children', type: 'ReactNode', initial: 'the value', does: 'What is shown.' },
        ],
      },
      {
        slug: 'code-block', name: 'CodeBlock', group: 'Data',
        intro: 'Code to read and copy. For code someone edits, use CodeEditor.',
        from: "import { CodeBlock } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Plain', demo: <div className="fc-kitdoc__cell--wide"><CodeBlock code={'curl https://example.com/api/v1/products \\\n  -H "Authorization: Bearer <token>"'} /></div>, code: '<CodeBlock code={snippet} />' },
          { title: 'With a label', demo: <div className="fc-kitdoc__cell--wide"><CodeBlock label="manifest.json" code={'{\n  "slug": "finance",\n  "version": "0.1.172"\n}'} /></div>, code: '<CodeBlock label="manifest.json" code={json} />' },
        ],
        options: [
          { name: 'code', type: 'string', does: 'The text, shown as given.' },
          { name: 'label', type: 'ReactNode', does: 'A file name or a language, in a head over the code.' },
        ],
      },
      {
        slug: 'empty-state', name: 'EmptyState', group: 'Feedback',
        intro: 'What stands where a list or a card has nothing: what is missing, why, and the way to fill it.',
        from: "import { EmptyState } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Full', demo: <div className="fc-kitdoc__cell--wide"><EmptyState icon={<FrameworkIcons.Search size={18} />} title="No products" hint="Nothing matches the filters in force." action={<Button variant={ButtonVariant.SECONDARY}>Clear filters</Button>} /></div>, code: '<EmptyState\n  icon={<FrameworkIcons.Search size={18} />}\n  title="No products"\n  hint="Nothing matches the filters in force."\n  action={<Button variant={ButtonVariant.SECONDARY}>Clear filters</Button>}\n/>' },
          { title: 'Title only', demo: <div className="fc-kitdoc__cell--wide"><EmptyState title="No runs recorded yet" /></div>, code: '<EmptyState title="No runs recorded yet" />' },
          { title: 'Inline', text: 'On one line, for an empty part inside a card that holds other things.', demo: <div className="fc-kitdoc__cell--wide"><EmptyState inline icon={<FrameworkIcons.Plus size={16} />} title="No variants" hint="Add options to make variants." action={<Button variant={ButtonVariant.SECONDARY}>Add</Button>} /></div>, code: '<EmptyState inline title="No variants" hint="Add options to make variants." action={…} />' },
        ],
        options: [
          { name: 'title', type: 'string', does: 'What is missing.' },
          { name: 'hint', type: 'ReactNode', does: 'Why, or what to do.' },
          { name: 'icon', type: 'ReactNode', does: 'A quiet icon over the title.' },
          { name: 'action', type: 'ReactNode', does: 'The way to fill it.' },
          { name: 'inline', type: 'boolean', initial: 'false', does: 'One line instead of a centred block.' },
        ],
      },
    ];
  }
}
