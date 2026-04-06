// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SettingsLayout from './layout';

describe('SettingsLayout', () => {
  it('renders page content without a local settings sidebar', () => {
    render(
      <SettingsLayout>
        <div>Settings Content</div>
      </SettingsLayout>,
    );

    expect(screen.getByText('Settings Content')).not.toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});