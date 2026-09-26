/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { partsReferenceMarkdown } from '../src/model/partsReference';
import { parseDoc } from '../src/model/persistence';
import { Simulator } from '../src/sim/simulator';
import { buildNetlist } from '../src/sim/netlist';

const REF = 'docs/parts-reference.md';
const GUIDE = 'docs/llm-project-json.md';

describe('LLM docs', () => {
  it('docs/parts-reference.md matches the part definitions (run `npm run docs` to update)', () => {
    const md = partsReferenceMarkdown();
    if (process.env.UPDATE_DOCS) writeFileSync(REF, md);
    expect(existsSync(REF)).toBe(true);
    expect(readFileSync(REF, 'utf8')).toBe(md);
  });

  it('every JSON example in the guide loads, wires only real pins and simulates without errors', () => {
    const guide = readFileSync(GUIDE, 'utf8');
    const blocks = [...guide.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => b.includes('"components"'));
    expect(blocks.length).toBeGreaterThan(0);
    for (const src of blocks) {
      const raw = JSON.parse(src);
      const doc = parseDoc(raw);
      expect(doc.components.length, 'no part was dropped as unknown').toBe(raw.components.length);
      expect(doc.wires.length, 'no wire was dropped').toBe(raw.wires.length);
      const nl = buildNetlist(doc);
      for (const w of doc.wires) for (const end of [w.a, w.b]) expect(nl.netOf.has(`${end.comp}:${end.pin}`), `${end.comp}.${end.pin}`).toBe(true);
      const sim = new Simulator(doc);
      expect([...sim.start().values()]).toEqual([]);
      let snap = sim.snapshot();
      for (let i = 0; i < 25; i++) { sim.advance(0.02); snap = sim.snapshot(); }
      for (const [id, m] of sim.mcus) expect(m.error?.message, id).toBeUndefined();
      expect(snap.warnings.filter((w) => w.level === 'error')).toEqual([]);
    }
  });
});
