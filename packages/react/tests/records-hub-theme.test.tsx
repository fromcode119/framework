import { render } from '@testing-library/react';
import { ThemeMode } from '@fromcode119/core/client';
import { RecordsHubImplementation } from '@react/records-hub-implementation';

/**
 * The hub's mode arrives as the ThemeMode member or as its string: the People page and every plugin
 * page pass `theme.value`. Comparing the raw prop to the member was false for the string, so the hub
 * rendered its light surface on the dark admin.
 */
describe('RecordsHub theme', () => {
  const pending = (): Promise<never> => new Promise(() => undefined);

  it.each([['the string "dark"', 'dark'], ['the DARK member', ThemeMode.DARK]])('renders dark for %s', (_label, theme) => {
    const { container } = render(<RecordsHubImplementation load={pending} theme={theme} />);
    expect((container.firstChild as HTMLElement).className).toContain('bg-slate-900/40');
  });

  it.each([['the string "light"', 'light'], ['no theme', undefined]])('renders light for %s', (_label, theme) => {
    const { container } = render(<RecordsHubImplementation load={pending} theme={theme} />);
    expect((container.firstChild as HTMLElement).className).toContain('bg-white');
  });
});
