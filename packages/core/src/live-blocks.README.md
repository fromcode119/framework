# Theme contract for visual editing

The visual editor (admin overlay) is provided by the **CMS plugin** and built on
two framework primitives in `@fromcode119/sdk`:

| Primitive | Owner | What it does |
|-----------|-------|-------------|
| `InteractiveCanvas.Provider` | Framework | Tracks edit mode + selected block id. Mounted once at the layout level by the CMS plugin's `frontend.editor.app-shell` slot. |
| `InteractiveCanvas.Wrapper`  | Framework | Click target for a block. When the canvas is enabled, a click on the wrapper sets the target id → opens the inspector. |
| `LiveBlocks.publish`         | CMS plugin (publisher) | Pushes the editor's optimistic patches into a global store + `fc:live-blocks` event. |
| `LiveBlocks.useLiveBlocks`   | Framework hook (consumer) | React hook themes call to get patched blocks for the current page; falls back to baseline when no edit is active. |

## What a theme has to do to make a page editable

Any theme — current or new — opts a page into visual editing by following this
three-line contract per editable section:

```tsx
import { InteractiveCanvas, LiveBlocks } from '@fromcode119/sdk';

function MyThemePage({ page }) {
  // 1. Pull the live (patched) blocks during edit mode; baseline otherwise.
  const baseline = StaticPageState.getBlocks(page);
  const live = LiveBlocks.useLiveBlocks(page);
  const blocks = live ?? baseline;

  // 2. Resolve fields from the chosen blocks normally.
  const heroBlock = blocks.find(b => b.id === 'hero');

  // 3. Wrap each editable section so clicks open the inspector.
  return (
    <>
      <InteractiveCanvas.Wrapper id="hero">
        <HeroComponent block={heroBlock} />
      </InteractiveCanvas.Wrapper>
      {/* …more sections… */}
    </>
  );
}
```

That's the entire surface. Themes do **not** import from `@fromcode119/cms`,
do **not** know about the runtime, do **not** know about the inspector — they
just provide:

1. A baseline read path (whatever the theme already does).
2. A switch to the live patched blocks when the editor publishes them.
3. A click target per editable region.

Adding a new theme follows the same three lines per page that should be editable.

## Block schemas and inspector behavior

Schemas (what fields the inspector shows for a block type) live in the CMS
plugin (`block-schemas.ts`). Adding a new schema or modifying an existing one
is a **plugin** change — no theme involvement.

Auto-insert of default blocks (e.g. product pages get `product-related` +
`product-reviews` on first edit) lives in the CMS plugin's
`ProductPageDefaultsInjector` — also no theme involvement.

## Block renderers

The visual representation of a block is theme-specific and goes via the
existing override slot mechanism:

```ts
ContextBridge.registerOverride('cms.block.<type>', MyThemeRenderer, themeSlug, 11);
```

A new theme provides its own renderers; the inspector behavior is identical
across themes because it lives in the plugin.

## Summary

| Concern | Lives in |
|---------|---------|
| Visual editor UI (inspector, toolbar, picker) | CMS plugin |
| Block schemas (fields per type) | CMS plugin |
| Auto-insert defaults | CMS plugin |
| Runtime / save / undo | CMS plugin |
| InteractiveCanvas / LiveBlocks primitives | Framework (`@fromcode119/core`) |
| Block visual renderers | Theme |
| Click-target wrappers per editable section | Theme (3 lines per page) |
