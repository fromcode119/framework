import { describe, it, expect, vi } from 'vitest';
/** @vitest-environment jsdom */
import { render, screen, fireEvent } from '@testing-library/react';
import { PermalinkInput } from './permalink-input';
import React from 'react';

import { getCollectionPrefix } from '@/lib/collection-utils';

// Mock dependencies
vi.mock('@fromcode/react', () => ({
  usePlugins: () => ({
    settings: {
      frontend_url: 'http://frontend.framework.local',
      permalink_structure: '/:slug'
    }
  }),
  FrameworkIconRegistry: {
    registerProvider: () => {}
  },
  FrameworkIcons: {
    Edit: () => <div data-testid="edit-icon" />,
    Refresh: () => <div data-testid="refresh-icon" />,
    Layout: () => <div data-testid="layout-icon" />
  },
  IconNames: {}
}));

vi.mock('@/lib/icons', () => ({
  FrameworkIcons: {
    Edit: () => <div data-testid="edit-icon" />,
    Refresh: () => <div data-testid="refresh-icon" />,
    Layout: () => <div data-testid="layout-icon" />
  },
  IconNames: {}
}));

describe('PermalinkInput UI', () => {
  const mockCollection: any = {
    slug: 'posts',
    admin: {
      previewPrefixSettingsKey: 'postPrefix'
    }
  };

  const pluginSettings = { postPrefix: 'blog' };

  it('should display the correct prefix and slug in read-only mode', () => {
    render(
      <PermalinkInput 
        value="" 
        onChange={() => {}} 
        slug="hello-world" 
        collection={mockCollection}
        pluginSettings={pluginSettings}
      />
    );

    // Should show the domain + collection prefix + structure-based prefix
    expect(screen.getByText('http://frontend.framework.local/blog/')).toBeDefined();
    expect(screen.getByText('hello-world')).toBeDefined();
  });

  it('should enter edit mode when clicked and show the prefix again', () => {
    const { container } = render(
      <PermalinkInput 
        value="" 
        onChange={() => {}} 
        slug="hello-world" 
        collection={mockCollection}
        pluginSettings={pluginSettings}
      />
    );

    fireEvent.click(container.firstChild as HTMLElement);

    // In edit mode, it should show the prefix header above the input
    expect(screen.getByText('http://frontend.framework.local/blog/')).toBeDefined();
    
    // Should have an input with the current slug
    const input = screen.getByPlaceholderText('my-secret-path') as HTMLInputElement;
    expect(input.value).toBe('hello-world');
  });

  it('should show "Custom" tag when a custom value is provided', () => {
    render(
      <PermalinkInput 
        value="asdasddas" 
        onChange={() => {}} 
        slug="hello-world" 
        collection={mockCollection}
        pluginSettings={pluginSettings}
      />
    );

    expect(screen.getByText('Custom')).toBeDefined();
    expect(screen.getByText('asdasddas')).toBeDefined();
    expect(screen.getByText('http://frontend.framework.local/blog/')).toBeDefined();
  });

  it('should call onChange and stay in edit mode until saved', () => {
    const onChange = vi.fn();
    render(
      <PermalinkInput 
        value="" 
        onChange={onChange} 
        slug="hello-world" 
        collection={mockCollection}
        pluginSettings={pluginSettings}
      />
    );

    // Enter edit mode
    fireEvent.click(screen.getByText('hello-world'));

    const input = screen.getByPlaceholderText('my-secret-path');
    fireEvent.change(input, { target: { value: 'new-path' } });

    expect(onChange).toHaveBeenCalledWith('new-path');
  });
});
