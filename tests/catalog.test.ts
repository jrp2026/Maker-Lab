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
  it('each part is listed in exactly one category (Starters are shortcuts)', () => {
    const where = new Map<string, string[]>();
    for (const c of CATALOG) if (c.id !== 'basic') for (const e of c.entries) where.set(e.type!, [...(where.get(e.type!) ?? []), c.id]);
    expect([...where].filter(([, ids]) => ids.length > 1)).toEqual([]);
  });
  it('alternative board names stay searchable through keywords', () => {
    for (const [type, kw] of [['pico', 'rp2040'], ['arduino-mega', 'atmega2560'], ['stm32-bluepill', 'stm32f103'], ['atmega328p', 'avr']])
      expect(getDef(type)!.keywords, type).toContain(kw);
  });
});
