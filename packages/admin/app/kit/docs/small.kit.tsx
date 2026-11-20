import { KitCopy } from '@/app/kit/kit-copy';
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
import { Spinner } from '@/components/ui/view/spinner.client';
import { CopyValue } from '@/components/ui/view/copy-value.client';
import { CodeBlock } from '@/components/ui/view/code-block.client';
import { EmptyState } from '@/components/ui/view/empty-state.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import type { KitDoc } from '@/app/kit/kit-doc';

/** The small pieces: each has few options, so each page is short. */
export class SmallKit {
  static tileMenu(): any[] {
    return [{ label: KitCopy.t('docs.small.details'), onClick: () => undefined }, { label: KitCopy.t('docs.small.moveToFolder'), onClick: () => undefined }];
  }

  /** Four flat pictures drawn in place, so the example needs no file. */
  static pictures(): string[] {
    return ['#3f3f46', '#0f766e', '#7c3aed', '#b45309'].map((fill) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="${fill}"/></svg>`)}`);
  }

  static docs(): KitDoc[] {
    return [
      {
        slug: 'kbd', name: 'Kbd', group: KitCopy.t('docs.small.data'),
        intro: KitCopy.t('docs.small.aKeyOrKeysTo'),
        from: "import { Kbd } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.oneKeyAndAChord'), demo: <><Kbd>⌘K</Kbd><Kbd>{KitCopy.t('docs.small.esc')}</Kbd><span className="fc-kitdoc__inline"><Kbd>G</Kbd><Kbd>P</Kbd></span></>, code: '<Kbd>⌘K</Kbd>\n<Kbd>Esc</Kbd>' },
        ],
        options: [{ name: 'children', type: 'ReactNode', does: KitCopy.t('docs.small.theKeyAsItIs') }],
      },
      {
        slug: 'divider', name: 'Divider', group: KitCopy.t('docs.small.layout'),
        intro: KitCopy.t('docs.small.aHairlineBetweenTwoThings'),
        from: "import { Divider } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.horizontal'), demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><Divider /><Divider variant="dashed" /></div>, code: '<Divider />\n<Divider variant="dashed" />' },
          { title: KitCopy.t('docs.small.vertical'), text: KitCopy.t('docs.small.betweenControlsOnOneLine'), demo: <span className="fc-kitdoc__inline fc-kitdoc__tall"><span>{KitCopy.t('docs.small.export')}</span><Divider orientation="vertical" /><span>{KitCopy.t('docs.small.import')}</span></span>, code: '<Divider orientation="vertical" />' },
        ],
        options: [
          { name: 'orientation', type: "horizontal · vertical", initial: 'horizontal', does: KitCopy.t('docs.small.whichWayItRuns') },
          { name: 'variant', type: "solid · dashed", initial: 'solid', does: KitCopy.t('docs.small.theLine') },
        ],
      },
      {
        slug: 'skeleton', name: 'Skeleton', group: KitCopy.t('docs.small.feedback'),
        intro: KitCopy.t('docs.small.theShapeOfWhatIs'),
        from: "import { Skeleton } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.lines'), demo: <div className="fc-kitdoc__stack fc-kitdoc__cell"><Skeleton height={12} width="80%" /><Skeleton height={12} width="60%" /><Skeleton height={12} width="40%" /></div>, code: '<Skeleton height={12} width="80%" />\n<Skeleton height={12} width="60%" />' },
          { title: KitCopy.t('docs.small.aRowWithAPicture'), demo: <div className="fc-kit__skeleton fc-kitdoc__cell"><Skeleton width={32} height={32} round /><div className="fc-kit__skeleton-lines"><Skeleton height={12} width="70%" /><Skeleton height={12} width="40%" /></div></div>, code: '<Skeleton width={32} height={32} round />\n<Skeleton height={12} width="70%" />' },
        ],
        options: [
          { name: 'width, height', type: 'number | string', does: KitCopy.t('docs.small.itsSizeANumberIs') },
          { name: 'round', type: 'boolean', initial: 'false', does: KitCopy.t('docs.small.aCircleForAPicture') },
        ],
      },
      {
        slug: 'progress-bar', name: 'ProgressBar', group: KitCopy.t('docs.small.feedback'),
        intro: KitCopy.t('docs.small.howFarSomethingThatTakes'),
        from: "import { ProgressBar } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.withAKnownLength'), demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><ProgressBar value={12} /><ProgressBar value={64} label={KitCopy.t('docs.small.downloadingTheArchive')} detail="9 of 14 MB" /><ProgressBar value={100} label={KitCopy.t('docs.small.done')} detail="14 MB" /></div>, code: '<ProgressBar value={64} label="Downloading the archive" detail="9 of 14 MB" />' },
          { title: KitCopy.t('docs.small.aFigureThatIsHigh'), text: KitCopy.t('docs.small.forAMeasureRatherThan'), demo: <div className="fc-kitdoc__stack fc-kitdoc__cell--wide"><ProgressBar value={78} tone="warning" label={KitCopy.t('docs.small.disk')} detail="78%" /><ProgressBar value={94} tone="danger" label={KitCopy.t('docs.small.memory')} detail="94%" /></div>, code: '<ProgressBar value={94} tone="danger" label="Memory" detail="94%" />' },
          { title: KitCopy.t('docs.small.lengthNotKnown'), text: KitCopy.t('docs.small.withoutAValueTheBar'), demo: <div className="fc-kitdoc__cell--wide"><ProgressBar label={KitCopy.t('docs.small.preparingTheArchive')} /></div>, code: '<ProgressBar label="Preparing the archive" />' },
        ],
        options: [
          { name: 'value', type: 'number | null', does: KitCopy.t('docs.small.n0100LeftOutWhen') },
          { name: 'label', type: 'ReactNode', does: KitCopy.t('docs.small.whatIsGoingOn') },
          { name: 'detail', type: 'ReactNode', does: KitCopy.t('docs.small.howFarInTheCaller') },
          { name: 'tone', type: "warning · danger", does: KitCopy.t('docs.small.saysTheFigureIsHigh') },
        ],
      },
      {
        slug: 'tile', name: 'Tile', group: KitCopy.t('docs.small.data'),
        intro: KitCopy.t('docs.small.oneThingShownByIts'),
        from: "import { Tile } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.aPictureAFileWithout'), text: KitCopy.t('docs.small.theyStandInFcTile'), demo: <div className="fc-tile-grid fc-kitdoc__cell--wide"><KitPlay initial={true}>{(value, set) => <Tile title={KitCopy.t('docs.small.heroJpg')} facts="117 KB · JPEG" picture={SmallKit.pictures()[1]} marks={<Badge variant={BadgeVariant.SUCCESS}>WebP</Badge>} selected={value} onSelect={() => set(!value)} menu={SmallKit.tileMenu()} onOpen={() => undefined} openLabel="Open hero.jpg" />}</KitPlay><Tile title={KitCopy.t('docs.small.priceListPdf')} facts="352 KB · PDF" icon={<FrameworkIcons.File size={40} />} onSelect={() => undefined} menu={SmallKit.tileMenu()} onOpen={() => undefined} openLabel="Open price-list.pdf" /><Tile title={KitCopy.t('docs.small.products')} facts="Folder" icon={<FrameworkIcons.Folder size={40} />} menu={SmallKit.tileMenu()} onOpen={() => undefined} openLabel="Products" /></div>, code: '<div className="fc-tile-grid">\n  <Tile title="hero.jpg" facts="117 KB · JPEG" picture={url}\n    marks={<Badge variant={BadgeVariant.SUCCESS}>WebP</Badge>}\n    selected={chosen} onSelect={toggle}\n    menu={[{ label: \'Details\', onClick }, { label: \'Delete\', variant: DropdownItemVariant.DANGER, onClick }]}\n    onOpen={open} openLabel="Open hero.jpg" />\n</div>' },
        ],
        options: [
          { name: 'title', type: 'string', does: KitCopy.t('docs.small.theThingSNameCut') },
          { name: 'facts', type: 'string', does: KitCopy.t('docs.small.oneQuietLineUnderThe') },
          { name: 'picture', type: 'string', does: KitCopy.t('docs.small.thePictureSAddressWithout') },
          { name: 'video', type: 'string', does: KitCopy.t('docs.small.aVideoSAddressDrawn') },
          { name: 'icon', type: 'ReactNode', does: KitCopy.t('docs.small.drawnWhenThereIsNo') },
          { name: 'marks', type: 'ReactNode', does: KitCopy.t('docs.small.badgesOnThePictureWhat') },
          { name: 'selected', type: 'boolean', does: KitCopy.t('docs.small.chosenTheTileIsOutlined') },
          { name: 'onSelect', type: '() => void', does: KitCopy.t('docs.small.givenTheTileCarriesA') },
          { name: 'menu', type: 'IDropdownItem[]', does: KitCopy.t('docs.small.whatCanBeDoneWith') },
          { name: 'onOpen', type: '() => void', does: KitCopy.t('docs.small.thePictureWasPressed') },
          { name: 'openLabel', type: 'string', does: KitCopy.t('docs.small.whatPressingThePictureDoes') },
        ],
      },
      {
        slug: 'screenshot-gallery', name: 'ScreenshotGallery', group: KitCopy.t('docs.small.data'),
        intro: KitCopy.t('docs.small.thePicturesOfOneThing'),
        from: "import { ScreenshotGallery } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.severalPictures'), text: KitCopy.t('docs.small.aSmallPictureMakesIt'), demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={0}>{(value, set) => <ScreenshotGallery title={KitCopy.t('docs.small.screens')} images={SmallKit.pictures()} active={value} alt={KitCopy.t('docs.small.storefront')} onSelect={set} />}</KitPlay></div>, code: '<ScreenshotGallery title="Screens" images={urls} active={index} alt={name}\n  onSelect={setIndex} onOpen={openFullSize} />' },
          { title: KitCopy.t('docs.small.onePicture'), text: KitCopy.t('docs.small.noStripThereIsNothing'), demo: <div className="fc-kitdoc__cell--wide"><ScreenshotGallery title={KitCopy.t('docs.small.screens')} images={SmallKit.pictures().slice(0, 1)} active={0} alt={KitCopy.t('docs.small.storefront')} onSelect={() => undefined} /></div>, code: '<ScreenshotGallery title="Screens" images={[url]} active={0} alt={name} onSelect={setIndex} />' },
        ],
        options: [
          { name: 'title', type: 'string', does: KitCopy.t('docs.small.theCardSName') },
          { name: 'images', type: 'string[]', does: KitCopy.t('docs.small.thePicturesAddressesInOrder') },
          { name: 'active', type: 'number', does: KitCopy.t('docs.small.whichPictureIsLarge') },
          { name: 'alt', type: 'string', does: KitCopy.t('docs.small.whatThePicturesShowFor') },
          { name: 'onSelect', type: '(index: number) => void', does: KitCopy.t('docs.small.aSmallPictureWasPressed') },
          { name: 'onOpen', type: '() => void', does: KitCopy.t('docs.small.theLargePictureWasPressed') },
        ],
      },
      {
        slug: 'loader', name: 'Loader', group: KitCopy.t('docs.small.feedback'),
        intro: KitCopy.t('docs.small.aSpinnerWithAWord'),
        from: "import { Loader } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.withAndWithoutWords'), demo: <><Loader label={KitCopy.t('docs.small.loading')} /><Loader /></>, code: '<Loader label="Loading" />\n<Loader />' },
        ],
        options: [
          { name: 'label', type: 'string', does: KitCopy.t('docs.small.whatIsBeingWaitedFor') },
          { name: 'fullPage', type: 'boolean', initial: 'false', does: KitCopy.t('docs.small.centredInTheWholePage') },
        ],
      },
      {
        slug: 'spinner', name: 'Spinner', group: KitCopy.t('docs.small.feedback'),
        intro: KitCopy.t('docs.small.somethingHappeningRightHereInline'),
        from: "import { Spinner } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.inlineSmallInABadge'), demo: <><span className="fc-hint fc-kitdoc__inline"><Spinner small label={KitCopy.t('docs.small.readingTheRepository')} />{KitCopy.t('docs.small.readingTheRepository')}</span><Spinner /><Badge variant={BadgeVariant.INFO}><Spinner small className="me-1" />{KitCopy.t('docs.small.building')}</Badge></>, code: '<Spinner small label="Reading the repository" />\n<Spinner />\n<Badge variant={BadgeVariant.INFO}><Spinner small className="me-1" />Building</Badge>' },
          { title: KitCopy.t('docs.small.aButtonAtWork'), text: KitCopy.t('docs.small.theButtonKeepsItsIcon'), demo: <KitPlay initial={false}>{(busy, set) => <Button isLoading={busy} icon={<FrameworkIcons.Upload size={14} />} onClick={() => { set(true); setTimeout(() => set(false), 1500); }}>{KitCopy.t('docs.small.upload')}</Button>}</KitPlay>, code: '<Button isLoading={uploading} icon={<Upload size={14} />}>Upload</Button>' },
        ],
        options: [
          { name: 'small', type: 'boolean', initial: 'false', does: KitCopy.t('docs.small.n12pxInsteadOf16pxFor') },
          { name: 'label', type: 'string', does: KitCopy.t('docs.small.whatIsHappeningForA') },
          { name: 'className', type: 'string', does: KitCopy.t('docs.small.fcSpinnerMutedForThe') },
        ],
      },
      {
        slug: 'copy-value', name: 'CopyValue', group: KitCopy.t('docs.small.data'),
        intro: KitCopy.t('docs.small.aValueSomeoneCopiesElsewhere'),
        from: "import { CopyValue } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.theValueItself'), demo: <CopyValue value="prod_01M7R4CRJEHHPTTF1KVTJXKCEE" />, code: '<CopyValue value="prod_01M7R4CRJEHHPTTF1KVTJXKCEE" />' },
          { title: KitCopy.t('docs.small.showingSomethingElse'), text: KitCopy.t('docs.small.childrenIsWhatIsShown'), demo: <CopyValue value="maria@example.com"><a href="mailto:maria@example.com">{KitCopy.t('docs.small.mariaPetrova')}</a></CopyValue>, code: '<CopyValue value="maria@example.com">\n  <a href="mailto:maria@example.com">Maria Petrova</a>\n</CopyValue>' },
        ],
        options: [
          { name: 'value', type: 'string', does: KitCopy.t('docs.small.whatLandsOnTheClipboard') },
          { name: 'children', type: 'ReactNode', initial: 'the value', does: KitCopy.t('docs.small.whatIsShown') },
        ],
      },
      {
        slug: 'code-block', name: 'CodeBlock', group: KitCopy.t('docs.small.data'),
        intro: KitCopy.t('docs.small.codeToReadAndCopy'),
        from: "import { CodeBlock } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.plain'), demo: <div className="fc-kitdoc__cell--wide"><CodeBlock code={'curl https://example.com/api/v1/products \\\n  -H "Authorization: Bearer <token>"'} /></div>, code: '<CodeBlock code={snippet} />' },
          { title: KitCopy.t('docs.small.withALabel'), demo: <div className="fc-kitdoc__cell--wide"><CodeBlock label={KitCopy.t('docs.small.manifestJson')} code={'{\n  "slug": "finance",\n  "version": "0.1.172"\n}'} /></div>, code: '<CodeBlock label="manifest.json" code={json} />' },
        ],
        options: [
          { name: 'code', type: 'string', does: KitCopy.t('docs.small.theTextShownAsGiven') },
          { name: 'label', type: 'ReactNode', does: KitCopy.t('docs.small.aFileNameOrA') },
        ],
      },
      {
        slug: 'empty-state', name: 'EmptyState', group: KitCopy.t('docs.small.feedback'),
        intro: KitCopy.t('docs.small.whatStandsWhereAList'),
        from: "import { EmptyState } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.small.full'), demo: <div className="fc-kitdoc__cell--wide"><EmptyState icon={<FrameworkIcons.Search size={18} />} title={KitCopy.t('docs.small.noProducts')} hint={KitCopy.t('docs.small.nothingMatchesTheFiltersIn')} action={<Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.small.clearFilters')}</Button>} /></div>, code: '<EmptyState\n  icon={<FrameworkIcons.Search size={18} />}\n  title="No products"\n  hint="Nothing matches the filters in force."\n  action={<Button variant={ButtonVariant.SECONDARY}>Clear filters</Button>}\n/>' },
          { title: KitCopy.t('docs.small.titleOnly'), demo: <div className="fc-kitdoc__cell--wide"><EmptyState title={KitCopy.t('docs.small.noRunsRecordedYet')} /></div>, code: '<EmptyState title="No runs recorded yet" />' },
          { title: KitCopy.t('docs.small.inline'), text: KitCopy.t('docs.small.onOneLineForAn'), demo: <div className="fc-kitdoc__cell--wide"><EmptyState inline icon={<FrameworkIcons.Plus size={16} />} title={KitCopy.t('docs.small.noVariants')} hint={KitCopy.t('docs.small.addOptionsToMakeVariants')} action={<Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.small.add')}</Button>} /></div>, code: '<EmptyState inline title="No variants" hint="Add options to make variants." action={…} />' },
        ],
        options: [
          { name: 'title', type: 'string', does: KitCopy.t('docs.small.whatIsMissing') },
          { name: 'hint', type: 'ReactNode', does: KitCopy.t('docs.small.whyOrWhatToDo') },
          { name: 'icon', type: 'ReactNode', does: KitCopy.t('docs.small.aQuietIconOverThe') },
          { name: 'action', type: 'ReactNode', does: KitCopy.t('docs.small.theWayToFillIt') },
          { name: 'inline', type: 'boolean', initial: 'false', does: KitCopy.t('docs.small.oneLineInsteadOfA') },
        ],
      },
    ];
  }
}
