import { FrameworkIcons } from '@fromcode119/react';
import { Kbd } from '@/components/ui/view/kbd.client';
import { Divider } from '@/components/ui/view/divider.client';
import { Skeleton } from '@/components/ui/view/skeleton.client';
import { ProgressBar } from '@/components/ui/view/progress-bar.client';
import { Loader } from '@/components/ui/view/loader.client';
import { CopyValue } from '@/components/ui/view/copy-value.client';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { KitDoc } from '@/app/kit/kit-doc';

/** The small pieces: each has few options, so each page is short. */
export class SmallKit {
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
          { title: 'Length not known', text: 'Without a value the bar runs on its own: it says only that the thing is going.', demo: <div className="fc-kitdoc__cell--wide"><ProgressBar label="Preparing the archive" /></div>, code: '<ProgressBar label="Preparing the archive" />' },
        ],
        options: [
          { name: 'value', type: 'number | null', does: '0–100; left out when the length is not known.' },
          { name: 'label', type: 'ReactNode', does: 'What is going on.' },
          { name: 'detail', type: 'ReactNode', does: 'How far, in the caller’s words.' },
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
