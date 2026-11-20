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
        slug: 'media-field', name: 'MediaRelationField', group: 'Forms',
        intro: 'A picture or a file chosen from the library. Empty, it is a plain square to press — it does not say “no image”.',
        from: "import { MediaRelationField } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'One', demo: <div className="fc-kitdoc__cell"><KitPlay initial={null}>{(value, set) => <MediaRelationField value={value} onChange={set} theme={ThemeMode.LIGHT} />}</KitPlay></div>, code: '<MediaRelationField value={image} onChange={setImage} theme={theme} />' },
          { title: 'Several', text: 'With `hasMany` it is a row of squares with one more to add; they can be put in order.', demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={null}>{(value, set) => <MediaRelationField hasMany value={value} onChange={set} theme={ThemeMode.LIGHT} />}</KitPlay></div>, code: '<MediaRelationField hasMany value={images} onChange={setImages} theme={theme} />' },
          { title: 'In a row of a table', text: '`compact` is a 32px square, the height of a field.', demo: <KitPlay initial={null}>{(value, set) => <MediaRelationField compact value={value} onChange={set} theme={ThemeMode.LIGHT} />}</KitPlay>, code: '<MediaRelationField compact value={image} onChange={setImage} theme={theme} />' },
        ],
        options: [
          { name: 'value, onChange', type: 'media | media[], (value) => void', does: 'What is chosen.' },
          { name: 'hasMany', type: 'boolean', initial: 'false', does: 'Several, in an order.' },
          { name: 'compact', type: 'boolean', initial: 'false', does: 'A square the height of a field.' },
          { name: 'wholeImage', type: 'boolean', initial: 'false', does: 'Shows the whole picture instead of filling the square.' },
          { name: 'accept', type: 'string', does: 'Which kinds of file may be chosen.' },
        ],
      },
      {
        slug: 'color-field', name: 'ColorField', group: 'Forms',
        intro: 'A colour: a field showing the colour and its value, opening a palette, a picker and the value to type. Plugins may import it as ColorPicker; it is the same control.',
        from: "import { ColorField } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'Plain and disabled', demo: <><KitPlay initial="#3b82f6">{(value, set) => <ColorField value={value} onChange={set} />}</KitPlay><ColorField value="#18181b" onChange={() => undefined} disabled /></>, code: '<ColorField value={colour} onChange={setColour} />\n<ColorField value={colour} onChange={setColour} disabled />' },
          { title: 'Not set, and a colour that is not a hex', demo: <><KitPlay initial="">{(value, set) => <ColorField value={value} onChange={set} />}</KitPlay><KitPlay initial="rgb(16, 185, 129)">{(value, set) => <ColorField value={value} onChange={set} />}</KitPlay></>, code: '<ColorField value="" onChange={setColour} />\n<ColorField value="rgb(16, 185, 129)" onChange={setColour} />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string, (value) => void', does: 'The colour: a hex from the palette or picker, or any colour typed. Empty reads “Not set”.' },
          { name: 'className', type: 'string', initial: '—', does: 'Classes on the wrapper; the field fills it.' },
          { name: 'disabled', type: 'boolean', initial: 'false', does: 'Not available.' },
        ],
      },
      {
        slug: 'chips-and-tags', name: 'ChipInputField and TagField', group: 'Forms',
        intro: 'A list of short words. ChipInputField is free text, each entry a chip. TagField chooses from what a collection already holds, and may add to it.',
        from: "import { ChipInputField, TagField } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'ChipInputField', text: 'Enter or a comma ends a chip; Backspace on an empty field removes the last one.', demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={['cotton', 'summer']}>{(value, set) => <ChipInputField value={value} onChange={set} field={{ admin: { placeholder: 'Add a value' } }} />}</KitPlay></div>, code: "<ChipInputField value={values} onChange={setValues} field={{ admin: { placeholder: 'Add a value' } }} />" },
          { title: 'TagField', demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={['New', 'Sale']}>{(value, set) => <TagField value={value} onChange={set} hasMany allowCreate placeholder="Add a tag" />}</KitPlay></div>, code: '<TagField value={tags} onChange={setTags} hasMany allowCreate placeholder="Add a tag"\n  sourceCollection="products" sourceField="tags" />' },
          { title: 'Disabled', demo: <div className="fc-kitdoc__cell--wide"><ChipInputField value={['cotton']} onChange={() => undefined} disabled /></div>, code: '<ChipInputField value={values} onChange={setValues} disabled />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string[], (value) => void', does: 'The words.' },
          { name: 'TagField hasMany', type: 'boolean', initial: 'false', does: 'Several tags instead of one.' },
          { name: 'TagField allowCreate', type: 'boolean', initial: 'false', does: 'A word not found can be added.' },
          { name: 'TagField sourceCollection, sourceField', type: 'string', does: 'Where the suggestions come from.' },
          { name: 'placeholder, disabled', type: 'string, boolean', does: 'Shown while empty / not available.' },
        ],
      },
      {
        slug: 'code-editor', name: 'CodeEditor', group: 'Forms',
        intro: 'Code someone edits: JSON, CSS, a template. For code that is only read, use CodeBlock.',
        from: "import { CodeEditor } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'JSON', demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={'{\n  "handle": "cotton-t-shirt"\n}'}>{(value, set) => <CodeEditor value={value} onChange={set} language="json" height="120px" />}</KitPlay></div>, code: '<CodeEditor value={json} onChange={setJson} language="json" height="120px" />' },
          { title: 'Disabled', demo: <div className="fc-kitdoc__cell--wide"><CodeEditor value={'.title { color: red; }'} onChange={() => undefined} language="css" height="80px" disabled /></div>, code: '<CodeEditor value={css} onChange={setCss} language="css" disabled />' },
        ],
        options: [
          { name: 'value, onChange', type: 'string, (value) => void', does: 'The code.' },
          { name: 'language', type: 'string', does: 'json, css, html, javascript…' },
          { name: 'height', type: 'string', does: 'How tall it is.' },
          { name: 'disabled', type: 'boolean', initial: 'false', does: 'May be read, not changed.' },
        ],
      },
      {
        slug: 'file-drop', name: 'FileDropzone and DropArea', group: 'Forms',
        intro: 'Where a file is given. FileDropzone takes ONE file and shows it uploading. DropArea is the target alone, for a page that takes many and lists them itself.',
        from: "import { FileDropzone, DropArea } from '@fromcode119/sdk/admin';",
        examples: [
          { title: 'FileDropzone', demo: <div className="fc-kitdoc__cell--wide"><KitPlay initial={null}>{(value, set) => <FileDropzone file={value} onSelect={set} hint="One file, up to 20 MB" />}</KitPlay></div>, code: '<FileDropzone file={file} onSelect={setFile} hint="One file, up to 20 MB" busy={uploading} percent={percent} />' },
          { title: 'DropArea', demo: <div className="fc-kitdoc__cell--wide"><DropArea title="Drag files here" hint="Images, videos or documents." action={<Button variant={ButtonVariant.SECONDARY}>Browse files</Button>} /></div>, code: '<DropArea title="Drag files here" hint="Images, videos or documents."\n  over={dragging} onDragOver={…} onDrop={…}\n  action={<Button variant={ButtonVariant.SECONDARY}>Browse files</Button>} />' },
          { title: 'DropArea while something is held over it', demo: <div className="fc-kitdoc__cell--wide"><DropArea over title="Drop to upload" hint="3 files" /></div>, code: '<DropArea over title="Drop to upload" hint="3 files" />' },
        ],
        options: [
          { name: 'FileDropzone file, onSelect', type: 'File | null, (file) => void', does: 'The chosen file.' },
          { name: 'FileDropzone busy, percent', type: 'boolean, number', does: 'Uploading, and how far.' },
          { name: 'hint', type: 'ReactNode', does: 'What may be given: kinds, size.' },
          { name: 'DropArea title, action', type: 'ReactNode', does: 'What to do, and the button for those who do not drag.' },
          { name: 'DropArea over', type: 'boolean', does: 'Something is held over it.' },
          { name: 'DropArea onDragEnter/Over/Leave, onDrop', type: 'handlers', does: 'The page’s own drag handling.' },
        ],
      },
      {
        slug: 'repeat-row', name: 'RepeatRow and VisualMenuField', group: 'Forms',
        intro: 'One row of a group that repeats, when each row holds several fields: a raised card with each field’s words on the left of its control, in a column only as wide as the words, and the row’s tools on the right — remove, and the handle that moves it. The handle is dragged, or focused and moved with the arrow keys, so there is no column of arrows. A number in a row is a plain field. VisualMenuField is a menu built from these rows, nested by depth.',
        from: "import { RepeatRow, RepeatRowAdd, RepeatRowGrip, VisualMenuField } from '@fromcode119/sdk/admin';",
        examples: [
          {
            title: 'Rows in a list',
            text: 'The rows go in `<ul className="fc-repeat__rows">` inside `.fc-repeat`, followed by RepeatRowAdd. In a field, Add moves up to the end of the field’s title line and the rows follow below; a list with its own small heading is wrapped in `.fc-repeat-titled` for the same placement. Tools are `.fc-repeat__tool` buttons, each with a label; two at most stand in a column, so they never make the row taller than its fields.',
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
                      <span className="fc-field-label">Quantity pricing</span>
                      <div className="fc-repeat">
                        {rows.length ? (
                          <ul className="fc-repeat__rows">
                            {rows.map((row, at) => (
                              <RepeatRow
                                key={at}
                                fields={[
                                  { key: 'from', label: 'From quantity', control: <NumberStepper value={row.from} onChange={(from) => patch(at, { from })} /> },
                                  { key: 'price', label: 'Unit price', control: <NumberStepper value={row.price} onChange={(price) => patch(at, { price })} /> },
                                ]}
                                tools={<>
                                  <button type="button" className="fc-repeat__tool" aria-label="Delete" title="Delete" onClick={() => set(rows.filter((_, i) => i !== at))}><FrameworkIcons.Close size={14} /></button>
                                  {rows.length > 1 ? <RepeatRowGrip label="Drag to move, or use the arrow keys" onMove={(key: string) => move(at, key)} /> : null}
                                </>}
                              />
                            ))}
                          </ul>
                        ) : null}
                        <RepeatRowAdd label="Add" onAdd={() => set([...rows, { from: '', price: '' }])} />
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
            title: 'A row without words',
            text: 'When no field has a label (one line of text, a pair the group heading names), the controls stand side by side.',
            demo: (
              <ul className="fc-kitdoc__cell--wide fc-repeat__rows">
                <RepeatRow fields={[{ key: 'line', control: <Input value="Free returns for 30 days" onChange={() => undefined} /> }]}
                  tools={<button type="button" className="fc-repeat__tool" aria-label="Delete" title="Delete"><FrameworkIcons.Close size={14} /></button>} />
              </ul>
            ),
            code: "<RepeatRow fields={[{ key: 'line', control: <Input … /> }]} tools={…} />",
          },
          {
            title: 'VisualMenuField',
            text: 'Drag an item by its handle, or focus the handle: up and down move it, right nests it under the one above, left moves it back out.',
            demo: (
              <div className="fc-kitdoc__cell--wide">
                <KitPlay initial={[{ label: 'Shop', url: '/shop', depth: 0 }, { label: 'T-shirts', url: '/shop/t-shirts', depth: 1 }, { label: 'About', url: '/about', depth: 0 }]}>
                  {(value, set) => <VisualMenuField value={value} onChange={set} collectionSlug="menus" field={{ fields: [{ name: 'label', type: 'text', label: 'Label' }, { name: 'url', type: 'text', label: 'Address' }] }} />}
                </KitPlay>
              </div>
            ),
            code: "<VisualMenuField value={items} onChange={setItems} collectionSlug=\"menus\"\n  field={{ fields: [{ name: 'label', type: 'text', label: 'Label' }, { name: 'url', type: 'text', label: 'Address' }] }} />",
          },
        ],
        options: [
          { name: 'fields', type: '{ key, label?, control }[]', does: 'The row’s fields, each with its words and its control.' },
          { name: 'tools', type: 'ReactNode', does: 'The row’s buttons: remove, then a RepeatRowGrip when the row can move. Two to a column.' },
          { name: 'depth', type: 'number', initial: '0', does: 'How far the row is nested (24px a level).' },
          { name: 'dragging, draggable, onDrag…', type: 'boolean, handlers', does: 'Reordering by dragging the row (draggable while the pointer is on the grip).' },
          { name: 'RepeatRowGrip onMove', type: '(key) => number | null', does: 'An arrow key pressed on the handle; answer the row’s new place, and focus follows it.' },
          { name: 'RepeatRowAdd label, onAdd, disabled', type: 'string, () => void, boolean', does: 'The Add button of the list; on the field’s title line when there is one.' },
        ],
      },
    ];
  }
}
