import { describe, expect, it, vi } from 'vitest';
import { SchemaRowProtection } from '@core/database/schema-row-protection';

describe('a collection that keeps its rows as written', () => {
  const collection: any = { slug: 'fcp_x', fields: [{ name: 'documentNumber' }, { name: 'issuedPdf' }, { name: 'note' }], protect: { writeOnce: ['documentNumber', 'issuedPdf'], noDelete: true } };

  it('protects the declared fields by their column names', async () => {
    const protect = vi.fn(async () => undefined);
    await SchemaRowProtection.apply({ supportsRowProtection: () => true, rowProtection: { protect }, dialect: 'postgres' } as any, 'fcp_x', collection, { warn: vi.fn() });
    expect(protect).toHaveBeenCalledWith('fcp_x', ['document_number', 'issued_pdf'], true);
  });

  it('says so when the driver cannot enforce it, instead of pretending', async () => {
    const warn = vi.fn();
    await SchemaRowProtection.apply({ supportsRowProtection: () => false, dialect: 'sqlite' } as any, 'fcp_x', collection, { warn });
    expect(warn.mock.calls[0][0]).toMatch(/cannot enforce/);
  });

  it('refuses to protect a field the collection does not declare', async () => {
    await expect(SchemaRowProtection.apply({ supportsRowProtection: () => true, rowProtection: { protect: vi.fn() }, dialect: 'postgres' } as any, 'fcp_x', { ...collection, protect: { writeOnce: ['nope'] } }, { warn: vi.fn() })).rejects.toThrow(/does not declare: nope/);
  });

  it('does nothing for a collection that declares no protection', async () => {
    const protect = vi.fn();
    await SchemaRowProtection.apply({ supportsRowProtection: () => true, rowProtection: { protect } } as any, 'fcp_x', { slug: 'fcp_x', fields: [] } as any, { warn: vi.fn() });
    expect(protect).not.toHaveBeenCalled();
  });
});
