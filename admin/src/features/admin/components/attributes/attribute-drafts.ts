import type { ProductAttribute, ProductAttributeInput } from '../../types';
import { attributeCopy } from './attribute-copy';

/** Editor-only identity and raw text preserve focus and unfinished separators while typing. */
export interface AttributeDraft {
  key: string;
  catalogAttributeId: string | null;
  name: string;
  termIds: string[];
  valuesText: string;
  isVisible: boolean;
}

/** Converts saved rows to independent controlled editor state, preserving API display order. */
export function attributeDrafts(rows: ProductAttribute[]): AttributeDraft[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder).map(row => ({
    key: crypto.randomUUID(), catalogAttributeId: row.catalogAttributeId ?? null,
    name: row.name, termIds: [...row.termIds], valuesText: row.values.join(' | '), isVisible: row.isVisible,
  }));
}

/** Validates and serializes the editor without sending copied global names or spoofed global values. */
export function serializeAttributes(rows: AttributeDraft[], locale: 'fa' | 'en'): ProductAttributeInput[] {
  const names = new Set<string>();
  if (rows.length > 30) throw new Error(attributeCopy[locale].invalid);
  return rows.map(row => {
    const name = row.name.trim();
    const key = row.catalogAttributeId ?? name.toLocaleLowerCase();
    const values = row.catalogAttributeId ? [] : row.valuesText.split('|').map(x => x.trim()).filter(Boolean);
    const count = row.catalogAttributeId ? row.termIds.length : values.length;
    if (names.has(key) || count < 1 || count > 30 || (!row.catalogAttributeId && (!name || name.length > 100 || values.some(x => x.length > 500)))) {
      throw new Error(attributeCopy[locale].invalid);
    }
    names.add(key);
    return { catalogAttributeId: row.catalogAttributeId, name: row.catalogAttributeId ? null : name,
      termIds: row.catalogAttributeId ? row.termIds : [], values: [...new Set(values)], isVisible: row.isVisible };
  });
}
