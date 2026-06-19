import type { PublisherFormData } from './publisher-portal.interfaces';

export class PublisherPortalConstants {
  static readonly EMPTY_PUBLISHER_FORM: PublisherFormData = {
    name: '',
    slug: '',
    version: '1.0.0',
    description: '',
    category: 'general',
    downloadUrl: '',
    iconUrl: '',
    capabilities: '',
    author: ''
  };

  static readonly PUBLISHER_CATEGORY_OPTIONS = [
    { value: 'general', label: 'General' },
    { value: 'business', label: 'Business' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'productivity', label: 'Productivity' },
    { value: 'testing', label: 'Testing' }
  ];
}
