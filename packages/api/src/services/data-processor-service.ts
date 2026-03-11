import { Collection } from '@fromcode119/core';
import { LocalizationService } from './localization-service';

export class DataProcessorService {
  constructor(
    private auth: any,
    private localization: LocalizationService
  ) {}

  public async processIncomingData(
    collection: Collection,
    data: any,
    table: any,
    options: {
      existingRecord?: any;
      localeContext: { locale: string; defaultLocale: string };
    }
  ) {
    const processedData: any = {};

    for (const key of Object.keys(data || {})) {
      if (!table[key]) continue;

      let value = data[key];
      const fieldConfig: any = collection.fields.find((f) => f.name === key);

      // Skip system fields
      if (key === 'createdAt') continue;
      if (key === 'updatedAt' && collection.slug !== 'settings') continue;

      // Password hashing
      if (collection.slug === 'users' && key === 'password' && this.auth && value) {
        value = await this.auth.hashPassword(value);
      }

      if (fieldConfig?.localized) {
        const existingMap =
          this.localization.parseLocaleMap(options?.existingRecord?.[key]) ||
          this.localization.parseLocaleMap(value) ||
          {};

        const incomingMap = this.localization.parseLocaleMap(value);
        const nextMap = { ...existingMap };

        if (incomingMap) {
          Object.assign(nextMap, incomingMap);
        } else {
          nextMap[options.localeContext.locale] = value;
        }

        value = this.localization.serializeLocaleMap(fieldConfig, nextMap);
        processedData[key] = value;
        continue;
      }

      // JSON/Array coercion
      const isJsonType = fieldConfig && this.localization.isJsonStorageField(fieldConfig.type);
      
      if (isJsonType) {
        if (value === '' || value === undefined || value === null) {
          value = null;
        }
      }

      if (fieldConfig && fieldConfig.type === 'array') {
        if (value === '' || value === undefined || value === null) {
          value = null;
        } else if (typeof value !== 'string') {
           value = JSON.stringify(value);
        }
      }

      if (fieldConfig && fieldConfig.type === 'date' && value && typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          value = date;
        }
      }

      processedData[key] = value;
    }

    return processedData;
  }

  public filterHiddenFields(
    collection: Collection, 
    data: any, 
    options: { localeContext: any; rawLocalized: boolean }
  ) {
    if (!data) return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.filterHiddenFields(collection, item, options));
    }

    const transformed = this.localization.transformOutgoingData(collection, data, options);
    
    // Ensure array fields are parsed if they came back as strings
    collection.fields.filter(f => f.type === 'array').forEach((field) => {
        const value = transformed[field.name];
        if (typeof value === 'string') {
            try {
                transformed[field.name] = JSON.parse(value);
            } catch {
                transformed[field.name] = [];
            }
        }
    });

    return transformed;
  }
}