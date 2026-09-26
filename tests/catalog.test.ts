import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/components/catalog';
import { DEFS, getDef } from '../src/components/registry';

describe('component catalog', () => {
  it('every catalog entry is a real, placeable part (nothing left "coming soon")', () => {
    for (const c of CATALOG) for (const e of c.entries) {
      expect(e.type, `${c.name}: ${e.name}`).toBeTruthy();
      expect(getDef(e.type!), e.type).toBeTruthy();
    }
  });
  it('every part appears in the catalog', () => {
    const listed = new Set(CATALOG.flatMap((c) => c.entries.map((e) => e.type)));
    expect(DEFS.filter((d) => !listed.has(d.type)).map((d) => d.type)).toEqual([]);
  });
});
