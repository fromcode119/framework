import { render, screen } from '@testing-library/react';
import { ThemeMode } from '@fromcode119/core/client';
import { FieldControlRenderer } from '@/components/collection/field-control-renderer';

/**
 * The whole path a declared list of rows takes: the dispatcher recognises it, the row list draws it as
 * a table, and a value the runtime cannot use says so where it is typed — with no component anywhere.
 *
 * The field below is a list of video links as a plugin now declares it, verbatim, down to the shape of
 * a link a player accepts. Fields like it used to name a control of their own — one for the links, one
 * for a table of specifications, one for prices per currency: three controls, and one shape between them.
 */
const PLAYABLE = '^https?://(?:www\\.|m\\.)?(?:youtube(?:-nocookie)?\\.com/(?:watch\\?(?:[^#]*&)?v=[A-Za-z0-9_-]{6,20}|(?:embed|shorts|live)/[A-Za-z0-9_-]{6,20})|youtu\\.be/[A-Za-z0-9_-]{6,20}|(?:player\\.)?vimeo\\.com/(?:[^/]+/)*[0-9]+)(?:[/?#]|$)';

const videos = {
  name: 'videos',
  type: 'json',
  label: 'Videos',
  fields: [
    { name: 'url', type: 'text', label: 'Link', admin: { pattern: PLAYABLE, patternNote: 'The product page leaves it out.' } },
    { name: 'title', type: 'text', label: 'Title' },
  ],
  admin: { layout: 'table', description: 'YouTube or Vimeo links.' },
};

function draw(value: any) {
  return render(
    <FieldControlRenderer
      field={videos as any}
      currentValue={value}
      resolvedCurrentText=""
      updateValue={() => {}}
      wrapWithReadOnlyOverride={(node: any) => node}
      onRequestReadOnlyOverride={() => {}}
      readOnlyOverrideGranted={false}
      theme={ThemeMode.LIGHT}
      collectionSlug="catalogue"
      fieldComponents={{}}
      isFieldReadOnly={false}
      isNew={false}
      label="Videos"
      isLocalizedField={false}
      shouldInlineLocaleSwitcher={false}
      localeSwitcher={() => null}
    />
  );
}

describe('a json field that declares its rows', () => {
  it('is drawn as a table, not as a JSON textarea', () => {
    draw([{ url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Promo' }]);
    expect(screen.queryByRole('textbox', { name: /videos/i })).toBeNull();
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Link', 'Title', 'Actions']);
    expect(screen.getByDisplayValue('https://youtu.be/dQw4w9WgXcQ')).toBeTruthy();
    expect(screen.getByDisplayValue('Promo')).toBeTruthy();
  });

  it('reads the rows out of the column even when it hands back their text', () => {
    draw('[{"url":"https://vimeo.com/123456789","title":"Tour"}]');
    expect(screen.getByDisplayValue('Tour')).toBeTruthy();
  });

  it('says what will happen to a link the player does not accept, and nothing about one it does', () => {
    draw([{ url: 'https://www.youtube.com/playlist?list=PL123', title: '' }]);
    expect(screen.getByText('The product page leaves it out.')).toBeTruthy();
    draw([{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: '' }]);
    expect(screen.queryAllByText('The product page leaves it out.')).toHaveLength(1);
  });
});
