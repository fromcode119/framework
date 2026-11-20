import { KitCopy } from '@/app/kit/kit-copy';
import { ThemeMode } from '@fromcode119/core/client';
import { MediaRelationField } from '@/components/collection/view/media-relation-field.client';
import { ColorField } from '@/components/ui/view/color-field.client';
import { ChipInputField } from '@/components/ui/view/chip-input-field.client';
import { TagField } from '@/components/ui/tag-field/view/index.client';
import { CodeEditor } from '@/components/ui/view/code-editor.client';
import { FileDropzone } from '@/components/ui/view/file-dropzone.client';
import { DropArea } from '@/components/ui/view/drop-area.client';
import { Button } from '@/components/ui/view/button.client';
import { ButtonVariant } from '@/components/ui/enums/button-variant.enum';
import { RepeatRow } from '@/components/ui/view/repeat-row.client';
import { RepeatRowGrip } from '@/components/ui/view/repeat-row-grip.client';
import { RepeatRowAdd } from '@/components/ui/view/repeat-row-add.client';
import { Input } from '@/components/ui/view/input.client';
import { VisualMenuField } from '@/components/ui/view/visual-menu-field.client';
import { NumberStepper } from '@/components/ui/number-stepper';
import { FrameworkIcons } from '@fromcode119/react';
import { KitPlay } from '@/app/kit/view/kit-play.client';
import type { KitDoc } from '@/app/kit/kit-doc';

/** The fields that are not a line of text: pictures, colours, lists of words, code, files. */
export class FieldsRichKit {
  static docs(): KitDoc[] {
    return [
      {
        slug: 'media-field', name: 'MediaRelationField', group: KitCopy.t('docs.fields-rich.forms'),
        intro: KitCopy.t('docs.fields-rich.aPictureOrAFile'),
        from: "import { MediaRelationField } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.fields-rich.one'), demo: <div className="fc-kitdoc__cell"><KitPlay initial={null}>{(value, set) => <MediaRelationField value={value} onChange={set} theme={ThemeMode.LIGHT} />}</KitPlay></div>, code: '<MediaRelationField value={image} onChange={setImage} theme={theme} />' },
          { title: KitCopy.t('docs.fields-rich.several'), text: KitCopy.t('docs.fields-rich.withHasmanyItIsA'), demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={null}>{(value, set) => <MediaRelationField hasMany value={value} onChange={set} theme={ThemeMode.LIGHT} />}</KitPlay></div>, code: '<MediaRelationField hasMany value={images} onChange={setImages} theme={theme} />' },
          { title: KitCopy.t('docs.fields-rich.inARowOfA'), text: KitCopy.t('docs.fields-rich.compactIsA32pxSquare'), demo: <KitPlay initial={null}>{(value, set) => <MediaRelationField compact value={value} onChange={set} theme={ThemeMode.LIGHT} />}</KitPlay>, code: '<MediaRelationField compact value={image} onChange={setImage} theme={theme} />' },
        ],
        options: [
          { name: 'value, onChange', type: 'media | media[], (value) => void', does: KitCopy.t('docs.fields-rich.whatIsChosen') },
          { name: 'hasMany', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-rich.severalInAnOrder') },
          { name: 'compact', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-rich.aSquareTheHeightOf') },
          { name: 'wholeImage', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-rich.showsTheWholePictureInstead') },
          { name: 'accept', type: 'string', does: KitCopy.t('docs.fields-rich.whichKindsOfFileMay') },
        ],
      },
      {
        slug: 'color-field', name: 'ColorField', group: KitCopy.t('docs.fields-rich.forms'),
        intro: KitCopy.t('docs.fields-rich.aColourAFieldShowing'),
        from: "import { ColorField } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.fields-rich.plainAndDisabled'), demo: <><KitPlay initial="#3b82f6">{(value, set) => <ColorField value={value} onChange={set} />}</KitPlay><ColorField value="#18181b" onChange={() => undefined} disabled /></>, code: '<ColorField value={colour} onChange={setColour} />\n<ColorField value={colour} onChange={setColour} disabled />' },
          { title: KitCopy.t('docs.fields-rich.notSetAndAColour'), demo: <><KitPlay initial="">{(value, set) => <ColorField value={value} onChange={set} />}</KitPlay><KitPlay initial="rgb(16, 185, 129)">{(value, set) => <ColorField value={value} onChange={set} />}</KitPlay></>, code: '<ColorField value="" onChange={setColour} />\n<ColorField value="rgb(16, 185, 129)" onChange={setColour} />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string, (value) => void', does: KitCopy.t('docs.fields-rich.theColourAHexFrom') },
          { name: 'className', type: 'string', initial: '—', does: KitCopy.t('docs.fields-rich.classesOnTheWrapperThe') },
          { name: 'disabled', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-rich.notAvailable') },
        ],
      },
      {
        slug: 'chips-and-tags', name: 'ChipInputField and TagField', group: KitCopy.t('docs.fields-rich.forms'),
        intro: KitCopy.t('docs.fields-rich.aListOfShortWords'),
        from: "import { ChipInputField, TagField } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.fields-rich.chipinputfield'), text: KitCopy.t('docs.fields-rich.enterOrACommaEnds'), demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={['cotton', 'summer']}>{(value, set) => <ChipInputField value={value} onChange={set} field={{ admin: { placeholder: KitCopy.t('docs.fields-rich.addAValue') } }} />}</KitPlay></div>, code: "<ChipInputField value={values} onChange={setValues} field={{ admin: { placeholder: 'Add a value' } }} />" },
          { title: KitCopy.t('docs.fields-rich.tagfield'), demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={['New', 'Sale']}>{(value, set) => <TagField value={value} onChange={set} hasMany allowCreate placeholder={KitCopy.t('docs.fields-rich.addATag')} />}</KitPlay></div>, code: '<TagField value={tags} onChange={setTags} hasMany allowCreate placeholder="Add a tag"\n  sourceCollection="products" sourceField="tags" />' },
          { title: KitCopy.t('docs.fields-rich.disabled'), demo: <div className="fc-kitdoc__cell--wide"><ChipInputField value={['cotton']} onChange={() => undefined} disabled /></div>, code: '<ChipInputField value={values} onChange={setValues} disabled />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string[], (value) => void', does: KitCopy.t('docs.fields-rich.theWords') },
          { name: 'TagField hasMany', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-rich.severalTagsInsteadOfOne') },
          { name: 'TagField allowCreate', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-rich.aWordNotFoundCan') },
          { name: 'TagField sourceCollection, sourceField', type: 'string', does: KitCopy.t('docs.fields-rich.whereTheSuggestionsComeFrom') },
          { name: 'placeholder, disabled', type: 'string, boolean', does: KitCopy.t('docs.fields-rich.shownWhileEmptyNotAvailable') },
        ],
      },
      {
        slug: 'code-editor', name: 'CodeEditor', group: KitCopy.t('docs.fields-rich.forms'),
        intro: KitCopy.t('docs.fields-rich.codeSomeoneEditsJsonCss'),
        from: "import { CodeEditor } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.fields-rich.json'), demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={'{\n  "handle": "cotton-t-shirt"\n}'}>{(value, set) => <CodeEditor value={value} onChange={set} language="json" height="120px" />}</KitPlay></div>, code: '<CodeEditor value={json} onChange={setJson} language="json" height="120px" />' },
          { title: KitCopy.t('docs.fields-rich.disabled'), demo: <div className="fc-kitdoc__cell--wide"><CodeEditor value={'.title { color: red; }'} onChange={() => undefined} language="css" height="80px" disabled /></div>, code: '<CodeEditor value={css} onChange={setCss} language="css" disabled />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string, (value) => void', does: KitCopy.t('docs.fields-rich.theCode') },
          { name: 'language', type: 'string', does: KitCopy.t('docs.fields-rich.jsonCssHtmlJavascript') },
          { name: 'height', type: 'string', does: KitCopy.t('docs.fields-rich.howTallItIs') },
          { name: 'disabled', type: 'boolean', initial: 'false', does: KitCopy.t('docs.fields-rich.mayBeReadNotChanged') },
        ],
      },
      {
        slug: 'file-drop', name: 'FileDropzone and DropArea', group: KitCopy.t('docs.fields-rich.forms'),
        intro: KitCopy.t('docs.fields-rich.whereAFileIsGiven'),
        from: "import { FileDropzone, DropArea } from '@fromcode119/sdk/admin';",
        examples: [
          { title: KitCopy.t('docs.fields-rich.filedropzone'), demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={null}>{(value, set) => <FileDropzone file={value} onSelect={set} hint={KitCopy.t('docs.fields-rich.oneFileUpTo20')} />}</KitPlay></div>, code: '<FileDropzone file={file} onSelect={setFile} hint="One file, up to 20 MB" busy={uploading} percent={percent} />' },
          { title: KitCopy.t('docs.fields-rich.droparea'), demo: <div className="fc-kitdoc__cell--wide"><DropArea title={KitCopy.t('docs.fields-rich.dragFilesHere')} hint={KitCopy.t('docs.fields-rich.imagesVideosOrDocuments')} action={<Button variant={ButtonVariant.SECONDARY}>{KitCopy.t('docs.fields-rich.browseFiles')}</Button>} /></div>, code: '<DropArea title="Drag files here" hint="Images, videos or documents."\n  over={dragging} onDragOver={…} onDrop={…}\n  action={<Button variant={ButtonVariant.SECONDARY}>Browse files</Button>} />' },
          { title: KitCopy.t('docs.fields-rich.dropareaWhileSomethingIsHeld'), demo: <div className="fc-kitdoc__cell--wide"><DropArea over title={KitCopy.t('docs.fields-rich.dropToUpload')} hint={KitCopy.t('docs.fields-rich.3Files')} /></div>, code: '<DropArea over title="Drop to upload" hint="3 files" />' },
        ],
        options: [
          { name: 'FileDropzone file, onSelect', type: 'File | null, (file) => void', does: KitCopy.t('docs.fields-rich.theChosenFile') },
          { name: 'FileDropzone busy, percent', type: 'boolean, number', does: KitCopy.t('docs.fields-rich.uploadingAndHowFar') },
          { name: 'hint', type: 'ReactNode', does: KitCopy.t('docs.fields-rich.whatMayBeGivenKinds') },
          { name: 'DropArea title, action', type: 'ReactNode', does: KitCopy.t('docs.fields-rich.whatToDoAndThe') },
          { name: 'DropArea over', type: 'boolean', does: KitCopy.t('docs.fields-rich.somethingIsHeldOverIt') },
          { name: 'DropArea onDragEnter/Over/Leave, onDrop', type: 'handlers', does: KitCopy.t('docs.fields-rich.thePageSOwnDrag') },
        ],
      },
      {
        slug: 'repeat-row', name: 'RepeatRow and VisualMenuField', group: KitCopy.t('docs.fields-rich.forms'),
        intro: KitCopy.t('docs.fields-rich.oneRowOfAGroup'),
        from: "import { RepeatRow, RepeatRowAdd, RepeatRowGrip, VisualMenuField } from '@fromcode119/sdk/admin';",
        examples: [
          {
            title: KitCopy.t('docs.fields-rich.rowsInAList'),
            text: KitCopy.t('docs.fields-rich.theRowsGoInUl'),
            demo: (
              <div className="fc-kitdoc__cell--wide">
                <KitPlay initial={[{ from: 1, price: 10 }, { from: 10, price: 8.5 }]}>
                  {(rows: Array<{ from: number | ''; price: number | '' }>, set) => {
                    const patch = (at: number, change: object) => set(rows.map((row, i) => (i === at ? { ...row, ...change } : row)));
                    const move = (at: number, key: string): number | null => {
                      const to = key === 'ArrowUp' ? at - 1 : key === 'ArrowDown' ? at + 1 : -1;
                      if (to < 0 || to >= rows.length) return null;
                      const next = [...rows];
                      next.splice(to, 0, next.splice(at, 1)[0]);
                      set(next);
                      return to;
                    };
                    return (
                      <div className="fc-repeat-titled space-y-2">
                      <span className="fc-field-label">{KitCopy.t('docs.fields-rich.quantityPricing')}</span>
                      <div className="fc-repeat">
                        {rows.length ? (
                          <ul className="fc-repeat__rows">
                            {rows.map((row, at) => (
                              <RepeatRow
                                key={at}
                                fields={[
                                  { key: 'from', label: KitCopy.t('docs.fields-rich.fromQuantity'), control: <NumberStepper value={row.from} onChange={(from) => patch(at, { from })} /> },
                                  { key: 'price', label: KitCopy.t('docs.fields-rich.unitPrice'), control: <NumberStepper value={row.price} onChange={(price) => patch(at, { price })} /> },
                                ]}
                                tools={<>
                                  <button type="button" className="fc-repeat__tool" aria-label={KitCopy.t('docs.fields-rich.delete')} title={KitCopy.t('docs.fields-rich.delete')} onClick={() => set(rows.filter((_, i) => i !== at))}><FrameworkIcons.Close size={14} /></button>
                                  {rows.length > 1 ? <RepeatRowGrip label={KitCopy.t('docs.fields-rich.dragToMoveOrUse')} onMove={(key: string) => move(at, key)} /> : null}
                                </>}
                              />
                            ))}
                          </ul>
                        ) : null}
                        <RepeatRowAdd label={KitCopy.t('docs.fields-rich.add')} onAdd={() => set([...rows, { from: '', price: '' }])} />
                      </div>
                      </div>
                    );
                  }}
                </KitPlay>
              </div>
            ),
            code: '<div className="fc-repeat-titled">\n<span className="fc-field-label">Quantity pricing</span>\n<div className="fc-repeat">\n<ul className="fc-repeat__rows">\n  <RepeatRow\n    fields={[{ key: \'from\', label: \'From quantity\', control: <NumberStepper … /> }]}\n    tools={<>\n      <button className="fc-repeat__tool" aria-label="Delete">…</button>\n      <RepeatRowGrip label="…" onMove={(key: string) => newIndexOrNull} />\n    </>} />\n</ul>\n<RepeatRowAdd label="Add" onAdd={addRow} />\n</div>\n</div>',
          },
          {
            title: KitCopy.t('docs.fields-rich.aRowWithoutWords'),
            text: KitCopy.t('docs.fields-rich.whenNoFieldHasA'),
            demo: (
              <ul className="fc-kitdoc__cell--wide fc-repeat__rows">
                <RepeatRow fields={[{ key: 'line', control: <Input value="Free returns for 30 days" onChange={() => undefined} /> }]}
                  tools={<button type="button" className="fc-repeat__tool" aria-label={KitCopy.t('docs.fields-rich.delete')} title={KitCopy.t('docs.fields-rich.delete')}><FrameworkIcons.Close size={14} /></button>} />
              </ul>
            ),
            code: "<RepeatRow fields={[{ key: 'line', control: <Input … /> }]} tools={…} />",
          },
          {
            title: KitCopy.t('docs.fields-rich.visualmenufield'),
            text: KitCopy.t('docs.fields-rich.dragAnItemByIts'),
            demo: (
              <div className="fc-kitdoc__cell--wide">
                <KitPlay initial={[{ label: KitCopy.t('docs.fields-rich.shop'), url: '/shop', depth: 0 }, { label: KitCopy.t('docs.fields-rich.tShirts'), url: '/shop/t-shirts', depth: 1 }, { label: KitCopy.t('docs.fields-rich.about'), url: '/about', depth: 0 }]}>
                  {(value, set) => <VisualMenuField value={value} onChange={set} collectionSlug="menus" field={{ fields: [{ name: 'label', type: 'text', label: KitCopy.t('docs.fields-rich.label') }, { name: 'url', type: 'text', label: KitCopy.t('docs.fields-rich.address') }] }} />}
                </KitPlay>
              </div>
            ),
            code: "<VisualMenuField value={items} onChange={setItems} collectionSlug=\"menus\"\n  field={{ fields: [{ name: 'label', type: 'text', label: 'Label' }, { name: 'url', type: 'text', label: 'Address' }] }} />",
          },
        ],
        options: [
          { name: 'fields', type: '{ key, label?, control }[]', does: KitCopy.t('docs.fields-rich.theRowSFieldsEach') },
          { name: 'tools', type: 'ReactNode', does: KitCopy.t('docs.fields-rich.theRowSButtonsRemove') },
          { name: 'depth', type: 'number', initial: '0', does: KitCopy.t('docs.fields-rich.howFarTheRowIs') },
          { name: 'dragging, draggable, onDrag…', type: 'boolean, handlers', does: KitCopy.t('docs.fields-rich.reorderingByDraggingTheRow') },
          { name: 'RepeatRowGrip onMove', type: '(key) => number | null', does: KitCopy.t('docs.fields-rich.anArrowKeyPressedOn') },
          { name: 'RepeatRowAdd label, onAdd, disabled', type: 'string, () => void, boolean', does: KitCopy.t('docs.fields-rich.theAddButtonOfThe') },
        ],
      },
    ];
  }
}
