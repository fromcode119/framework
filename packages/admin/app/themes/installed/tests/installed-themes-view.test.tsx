import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ThemeMode } from '@fromcode119/core/client';
import { InstalledThemesView } from '@/app/themes/installed/components/view/installed-themes-view.client';
import type { IInstalledThemeManifest } from '@/app/themes/installed/interfaces/installed-theme-manifest.interface';
import { AdminClass } from '@/lib/admin-class';

/**
 * The installed themes list puts the theme the site renders with in a block of its own, above the rest,
 * and every other theme offers Activate. That split is the whole point of the screen, so it is checked
 * on the rendered list rather than trusted to the filter that produces it.
 */
const theme = (slug: string, state: string): IInstalledThemeManifest =>
  ({ slug, name: slug.toUpperCase(), version: '1.0.0', author: 'Fromcode', description: `${slug} theme`, state } as IInstalledThemeManifest);

const renderView = (themes: IInstalledThemeManifest[], onActivate = vi.fn(async () => {})) =>
  render(
    <InstalledThemesView
      canManage={false} siteScope={false} siteQuota={null} loading={false} themes={themes} themeMode={ThemeMode.LIGHT}
      isDropActive={false} isInspectingUpload={false} isUploading={false} showUploadPreview={false}
      uploadProgressLabel={null} uploadProgressPercent={null} uploadPreviewDescription="" uploadPreviewSections={[]} uploadPreviewTitle=""
      fileInputRef={{ current: null } as any} closeUploadPreview={vi.fn()} confirmUploadPreview={vi.fn(async () => {})}
      handleDragLeave={vi.fn()} handleDragOver={vi.fn()} handleDrop={vi.fn(async () => {})} handleFileChange={vi.fn(async () => {})}
      handleUploadClick={vi.fn()} onActivate={onActivate} onDisable={vi.fn(async () => {})} onDelete={vi.fn(async () => {})}
      onUpdate={vi.fn(async () => {})} onDeleteMine={vi.fn(async () => {})} onNavigate={vi.fn()} updateVersionForTheme={() => null}
    />,
  );

describe('InstalledThemesView', () => {
  it('shows the active theme in its own block above the others, and Activate only on the others', () => {
    const onActivate = vi.fn(async () => {});
    const { container } = renderView([theme('quiet', 'inactive'), theme('shop', 'active'), theme('bold', 'inactive')], onActivate);

    const lists = container.querySelectorAll(`.${AdminClass.of('ext-list')}`);
    expect(lists).toHaveLength(2);
    expect(lists[0].textContent).toContain('SHOP');
    expect(lists[0].textContent).not.toContain('QUIET');
    expect(lists[1].textContent).toContain('QUIET');
    expect(lists[1].textContent).toContain('BOLD');

    const activateButtons = lists[1].querySelectorAll('button');
    const activate = Array.from(activateButtons).filter((button) => button.textContent && !button.getAttribute('aria-haspopup') && button.textContent.trim().length > 0);
    expect(activate.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(activate[0]);
    expect(onActivate).toHaveBeenCalledWith('quiet');
    expect(lists[0].querySelectorAll('button').length).toBeGreaterThan(0);
  });

  it('says so when no theme is active, instead of an empty block', () => {
    const { container } = renderView([theme('quiet', 'inactive')]);
    const lists = container.querySelectorAll(`.${AdminClass.of('ext-list')}`);
    expect(lists[0].className).toContain(AdminClass.of('ext-empty'));
    expect(screen.getByText('QUIET')).toBeTruthy();
  });
});
