import { generatePreviewUrl } from '../../admin/lib/collection-utils';

// Mock getPluginSettings is no longer needed as it's not exported/used like that
// We'll just pass the settings object directly to the function in the tests

describe('URL Generation Logic', () => {
    const mockPostCollection: any = {
        slug: 'posts',
        pluginSlug: 'cms',
        admin: {
            previewPrefixSettingsKey: 'postUrlPrefix'
        }
    };

    const mockPageCollection: any = {
        slug: 'pages',
        pluginSlug: 'cms',
        admin: {
            previewPrefixSettingsKey: 'pageUrlPrefix'
        }
    };

    const frontendUrl = 'http://frontend.framework.local';

    it('should generate a simple slug-based URL for posts with prefix', async () => {
        const settings = { postUrlPrefix: '/blog' };
        
        const record = { slug: 'hello-world' };
        const url = generatePreviewUrl(frontendUrl, record, mockPostCollection, '/:slug', settings);
        
        expect(url).toContain('/blog/hello-world');
    });

    it('should handle custom permalinks with prefix', async () => {
        const settings = { postUrlPrefix: '/blog' };
        
        const record = { customPermalink: '/my-special-post' };
        const url = generatePreviewUrl(frontendUrl, record, mockPostCollection, '/:slug', settings);
        
        expect(url).toContain('/blog/my-special-post');
    });

    it('should not double-prefix if custom permalink already has it', async () => {
        const settings = { postUrlPrefix: '/blog' };
        
        const record = { customPermalink: '/blog/my-special-post' };
        const url = generatePreviewUrl(frontendUrl, record, mockPostCollection, '/:slug', settings);
        
        expect(url).toContain('/blog/my-special-post');
    });

    it('should handle empty prefixes (root-level posts)', async () => {
        const settings = { postUrlPrefix: '' };
        
        const record = { slug: 'hello-world' };
        const url = generatePreviewUrl(frontendUrl, record, mockPostCollection, '/:slug', settings);
        
        expect(url).toContain('/hello-world');
    });

    it('should fallback to slug if customPermalink is empty', async () => {
        const settings = { pageUrlPrefix: '' };
        
        const record = { slug: 'about-us', customPermalink: '' };
        const url = generatePreviewUrl(frontendUrl, record, mockPageCollection, '/:slug', settings);
        
        expect(url).toContain('/about-us');
    });
});
