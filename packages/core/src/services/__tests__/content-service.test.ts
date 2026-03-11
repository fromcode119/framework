import { describe, it, expect, beforeEach } from 'vitest';
import { ContentService } from '../content-service';

describe('ContentService', () => {
  let service: ContentService;

  beforeEach(() => {
    service = new ContentService();
  });

  describe('extractText', () => {
    it('returns strings as-is', () => {
      expect(service.extractText('Plain text')).toBe('Plain text');
      expect(service.extractText('Hello World')).toBe('Hello World');
    });

    it('handles empty strings', () => {
      expect(service.extractText('')).toBe('');
    });

    it('handles null and undefined', () => {
      expect(service.extractText(null)).toBe('');
      expect(service.extractText(undefined)).toBe('');
    });

    it('handles non-array content', () => {
      expect(service.extractText({ invalid: 'object' })).toBe('');
      expect(service.extractText(123 as any)).toBe('');
    });

    it('extracts text from block editor blocks', () => {
      const blocks = [
        { content: 'First paragraph' },
        { text: 'Second paragraph' }
      ];
      expect(service.extractText(blocks)).toBe('First paragraph Second paragraph');
    });

    it('extracts from nested children', () => {
      const blocks = [
        {
          children: [
            { text: 'Nested' },
            { text: 'content' }
          ]
        }
      ];
      expect(service.extractText(blocks)).toBe('Nested content'); // join with space
    });

    it('handles mixed block types', () => {
      const blocks = [
        { content: 'Paragraph' },
        { text: 'Text node' },
        { children: [{ text: 'Nested' }] },
        'Plain string'
      ];
      expect(service.extractText(blocks)).toBe('Paragraph Text node Nested Plain string');
    });

    it('filters out empty blocks', () => {
      const blocks = [
        { content: 'First' },
        null,
        { content: '' },
        { text: 'Second' }
      ];
      expect(service.extractText(blocks)).toBe('First Second');
    });

    it('handles deeply nested structures', () => {
      const blocks = [
        {
          children: [
            {
              text: 'Deep', // Direct text property
              children: [
                { text: 'Nested' }
              ]
            }
          ]
        }
      ];
      expect(service.extractText(blocks)).toBe('Deep'); // Only extracts text from first level children
    });

    it('handles empty arrays', () => {
      expect(service.extractText([])).toBe('');
    });
  });

  describe('collectStrings', () => {
    it('returns single strings in array', () => {
      expect(service.collectStrings('Hello')).toEqual(['Hello']);
      expect(service.collectStrings('World')).toEqual(['World']);
    });

    it('handles JSON strings', () => {
      const jsonStr = '{"en":"Hello","bg":"Здравей"}';
      const result = service.collectStrings(jsonStr);
      expect(result).toContain('Hello');
      expect(result).toContain('Здравей');
    });

    it('handles JSON arrays', () => {
      const jsonStr = '["First","Second","Third"]';
      const result = service.collectStrings(jsonStr);
      expect(result).toEqual(['First', 'Second', 'Third']);
    });

    it('returns non-JSON strings as-is', () => {
      expect(service.collectStrings('Plain text')).toEqual(['Plain text']);
    });

    it('collects from objects', () => {
      const obj = { a: 'First', b: 'Second', c: 'Third' };
      const result = service.collectStrings(obj);
      expect(result).toContain('First');
      expect(result).toContain('Second');
      expect(result).toContain('Third');
      expect(result.length).toBe(3);
    });

    it('collects from arrays', () => {
      const arr = ['First', 'Second', 'Third'];
      const result = service.collectStrings(arr);
      expect(result).toEqual(['First', 'Second', 'Third']);
    });

    it('handles nested objects', () => {
      const obj = {
        level1: {
          level2: 'Nested value'
        }
      };
      const result = service.collectStrings(obj);
      expect(result).toContain('Nested value');
    });

    it('handles nested JSON strings', () => {
      const obj = {
        data: '{"nested":"value"}'
      };
      const result = service.collectStrings(obj);
      expect(result).toContain('value');
    });

    it('filters out non-string primitives', () => {
      const obj = {
        str: 'text',
        num: 123,
        bool: true,
        nul: null,
        undef: undefined
      };
      const result = service.collectStrings(obj);
      expect(result).toEqual(['text']);
    });

    it('handles empty inputs', () => {
      expect(service.collectStrings(null)).toEqual([]);
      expect(service.collectStrings(undefined)).toEqual([]);
      expect(service.collectStrings({})).toEqual([]);
      expect(service.collectStrings([])).toEqual([]);
    });

    it('handles malformed JSON gracefully', () => {
      const result = service.collectStrings('{invalid json}');
      expect(result).toEqual(['{invalid json}']);
    });

    it('handles mixed nested data', () => {
      const data = {
        title: 'Title',
        content: '{"locale":"en","text":"Hello"}',
        tags: ['tag1', 'tag2'],
        meta: {
          author: 'John',
          nested: {
            deep: 'value'
          }
        }
      };
      const result = service.collectStrings(data);
      expect(result).toContain('Title');
      expect(result).toContain('en');
      expect(result).toContain('Hello');
      expect(result).toContain('tag1');
      expect(result).toContain('tag2');
      expect(result).toContain('John');
      expect(result).toContain('value');
    });
  });

  describe('looksLikeJson', () => {
    it('detects JSON objects', () => {
      expect(service.looksLikeJson('{}')).toBe(true);
      expect(service.looksLikeJson('{"key":"value"}')).toBe(true);
      expect(service.looksLikeJson('{ "nested": { "obj": true } }')).toBe(true);
    });

    it('detects JSON arrays', () => {
      expect(service.looksLikeJson('[]')).toBe(true);
      expect(service.looksLikeJson('["a","b","c"]')).toBe(true);
      expect(service.looksLikeJson('[1, 2, 3]')).toBe(true);
    });

    it('rejects non-JSON strings', () => {
      expect(service.looksLikeJson('Plain text')).toBe(false);
      expect(service.looksLikeJson('Hello World')).toBe(false);
      expect(service.looksLikeJson('')).toBe(false);
    });

    it('rejects incomplete JSON', () => {
      expect(service.looksLikeJson('{')).toBe(false);
      expect(service.looksLikeJson('}')).toBe(false);
      expect(service.looksLikeJson('[')).toBe(false);
      expect(service.looksLikeJson('{"key":')).toBe(false);
    });

    it('handles whitespace', () => {
      expect(service.looksLikeJson('  {}  ')).toBe(true);
      expect(service.looksLikeJson('\n[\n]\n')).toBe(true);
      expect(service.looksLikeJson('\t{"key":"value"}\t')).toBe(true);
    });

    it('rejects strings with braces in wrong positions', () => {
      expect(service.looksLikeJson('text {}')).toBe(false);
      expect(service.looksLikeJson('{} text')).toBe(false);
      expect(service.looksLikeJson('text [] text')).toBe(false);
    });
  });

  describe('parseAttributes', () => {
    it('parses double-quoted values', () => {
      const result = service.parseAttributes('key="value"');
      expect(result).toEqual({ key: 'value' });
    });

    it('parses single-quoted values', () => {
      const result = service.parseAttributes("key='value'");
      expect(result).toEqual({ key: 'value' });
    });

    it('parses unquoted values', () => {
      const result = service.parseAttributes('key=value');
      expect(result).toEqual({ key: 'value' });
    });

    it('parses multiple attributes', () => {
      const result = service.parseAttributes('source="content" limit=5 type="post"');
      expect(result).toEqual({
        source: 'content',
        limit: '5',
        type: 'post'
      });
    });

    it('handles mixed quote styles', () => {
      const result = service.parseAttributes('a="double" b=\'single\' c=bare');
      expect(result).toEqual({
        a: 'double',
        b: 'single',
        c: 'bare'
      });
    });

    it('handles values with spaces in quotes', () => {
      const result = service.parseAttributes('title="Hello World" desc=\'Multiple Words\'');
      expect(result).toEqual({
        title: 'Hello World',
        desc: 'Multiple Words'
      });
    });

    it('handles empty values', () => {
      const result = service.parseAttributes('empty="" blank=\'\' present');
      expect(result).toEqual({
        empty: '',
        blank: ''
      });
    });

    it('handles dashes and underscores in keys', () => {
      const result = service.parseAttributes('my-key="value1" my_key="value2"');
      expect(result).toEqual({
        'my-key': 'value1',
        my_key: 'value2'
      });
    });

    it('handles numeric values', () => {
      const result = service.parseAttributes('count=10 price=19.99');
      expect(result).toEqual({
        count: '10',
        price: '19.99'
      });
    });

    it('handles empty string', () => {
      expect(service.parseAttributes('')).toEqual({});
    });

    it('ignores malformed attributes', () => {
      const result = service.parseAttributes('valid=yes invalid malformed=');
      expect(result).toEqual({ valid: 'yes' });
    });

    it('handles whitespace variations', () => {
      const result = service.parseAttributes('  a=1   b="2"    c=\'3\'  ');
      expect(result).toEqual({
        a: '1',
        b: '2',
        c: '3'
      });
    });
  });

  describe('sanitizeKey', () => {
    it('converts to lowercase', () => {
      expect(service.sanitizeKey('UpperCase')).toBe('uppercase');
      expect(service.sanitizeKey('MixedCASE')).toBe('mixedcase');
    });

    it('removes special characters', () => {
      expect(service.sanitizeKey('hello!@#$%world')).toBe('helloworld');
      expect(service.sanitizeKey('test&value')).toBe('testvalue');
    });

    it('preserves dashes and underscores', () => {
      expect(service.sanitizeKey('my-key')).toBe('my-key');
      expect(service.sanitizeKey('my_key')).toBe('my_key');
      expect(service.sanitizeKey('my-key_name')).toBe('my-key_name');
    });

    it('preserves alphanumeric characters', () => {
      expect(service.sanitizeKey('abc123xyz')).toBe('abc123xyz');
      expect(service.sanitizeKey('test01')).toBe('test01');
    });

    it('handles empty strings', () => {
      expect(service.sanitizeKey('')).toBe('');
      expect(service.sanitizeKey('   ')).toBe('');
    });

    it('trims whitespace', () => {
      expect(service.sanitizeKey('  key  ')).toBe('key');
      expect(service.sanitizeKey('\tkey\n')).toBe('key');
    });

    it('handles complex strings', () => {
      expect(service.sanitizeKey('Product: Name (2024)')).toBe('productname2024');
      expect(service.sanitizeKey('user@email.com')).toBe('useremailcom');
    });

    it('handles unicode characters', () => {
      expect(service.sanitizeKey('café')).toBe('caf');
      expect(service.sanitizeKey('naïve')).toBe('nave');
    });
  });
});
