import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/examples';
import { exportKicad, sheetPoint } from '../src/kicad/schematic';
import { buildFootprint, buildSymbol, isBoardPart, MM, pinNumbers, symbolLibrary } from '../src/kicad/parts';
import { zip } from '../src/kicad/zip';
import { getDef } from '../src/components/registry';
import { pivotOf, worldPins } from '../src/model/geometry';
import { buildNetlist } from '../src/sim/netlist';
import { validateSpec } from '../src/ai/spec';
import { defFromSpec } from '../src/ai/customPart';
import { registerSpec } from '../src/ai/library';
import { TELEGRAPH_KEY_SPEC } from '../src/ai/samplePart';
import type { CircuitDoc, ComponentInstance } from '../src/model/types';

/** s-expressions: parentheses balance outside of strings */
function balanced(text: string) {
  let depth = 0, str = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (str) {
      if (c === '\\') i++;
      else if (c === '"') str = false;
    } else if (c === '"') str = true;
    else if (c === '(') depth++;
    else if (c === ')' && --depth < 0) return false;
  }
  return depth === 0 && !str;
}

describe('KiCad export', () => {
  it('exports every example as a well-formed project with the same connections', () => {
    for (const ex of EXAMPLES) {
      const doc = ex.build();
      const out = exportKicad(doc);
      const names = Object.keys(out.files);
      expect(names.some((n) => n.endsWith('.kicad_sch')), ex.id).toBe(true);
      expect(names.some((n) => n.endsWith('.kicad_pro')), ex.id).toBe(true);
      expect(names.some((n) => n.endsWith('makerlab.kicad_sym')), ex.id).toBe(true);
      for (const [n, t] of Object.entries(out.files)) if (!n.endsWith('.kicad_pro')) expect(balanced(t), `${ex.id} ${n}`).toBe(true);

      // same partition of pins into nets as MakerLab's own netlist (board parts, ≥2 parts per net)
      const board = new Set(doc.components.filter((c) => { const d = getDef(c.type); return d && isBoardPart(d); }).map((c) => c.id));
      const expected = buildNetlist(doc).nets
        .map((n) => n.filter((k) => board.has(k.split(':')[0])))
        .filter((n) => new Set(n.map((k) => k.split(':')[0])).size >= 2)
        .map((n) => n.length).sort((a, b) => a - b);
      const got = Object.values(out.netPins).map((p) => p.length).sort((a, b) => a - b);
      expect(got, ex.id).toEqual(expected);
      expect(new Set(Object.keys(out.netPins)).size, ex.id).toBe(out.nets);
    }
  });

  it('puts symbol pins where the part pins are, for every rotation', () => {
    for (const type of ['resistor', 'led', 'npn', 'arduino-uno', 'ne555']) {
      const def = getDef(type)!;
      expect(def, type).toBeTruthy();
      const props = def.defaultProps;
      const sym = buildSymbol(def, props, type);
      const pv = pivotOf(def, props);
      for (let rot = 0; rot < 4; rot++) {
        const comp: ComponentInstance = { id: 'c', type, x: 120, y: 80, rot: rot as 0 | 1 | 2 | 3, flip: false, props };
        const world = worldPins(comp, def);
        for (const sp of sym.pins) {
          const at = sheetPoint(comp.x + pv.x, comp.y + pv.y, (360 - 90 * rot) % 360, sp.x, sp.y);
          const w = world.find((p) => p.id === sp.id)!;
          expect(at.x, `${type} rot${rot} ${sp.id}`).toBeCloseTo(w.wx * MM, 3);
          expect(at.y, `${type} rot${rot} ${sp.id}`).toBeCloseTo(w.wy * MM, 3);
        }
      }
    }
  });

  it('numbers footprint pads like the symbol pins', () => {
    for (const type of ['resistor', 'ne555', 'arduino-uno', 'lcd']) {
      const def = getDef(type)!;
      expect(def, type).toBeTruthy();
      const sym = buildSymbol(def, def.defaultProps, type);
      const fp = buildFootprint(def, def.defaultProps);
      const pads = [...fp.matchAll(/\(pad "([^"]+)"/g)].map((m) => m[1]);
      expect(pads.sort()).toEqual(sym.pins.map((p) => p.number).sort());
      expect(pads.sort()).toEqual(pinNumbers(def.pins(def.defaultProps)).sort());
      expect(balanced(fp)).toBe(true);
    }
  });

  it('exports AI-generated parts (symbol, footprint and schematic)', () => {
    const spec = validateSpec(TELEGRAPH_KEY_SPEC);
    const def = defFromSpec(spec);
    const lib = symbolLibrary([buildSymbol(def, def.defaultProps, spec.type).text]);
    expect(balanced(lib)).toBe(true);
    expect(lib).toContain(`(symbol "${spec.type}"`);
    const fp = buildFootprint(def, def.defaultProps);
    expect([...fp.matchAll(/\(pad /g)].length).toBe(spec.pins.length);

    registerSpec(spec);
    const doc: CircuitDoc = { version: 1, name: 'ai part', wires: [], components: [
      { id: 'a', type: spec.type, x: 0, y: 0, rot: 0, flip: false, props: def.defaultProps },
    ] };
    const out = exportKicad(doc);
    expect(out.parts).toBe(1);
    expect(Object.values(out.files).join('\n')).toContain(`makerlab:${spec.type}`);
  });

  it('zips files with valid headers', () => {
    const z = zip({ 'a/b.txt': 'hello', 'c.txt': 'wörld' });
    const dv = new DataView(z.buffer, z.byteOffset, z.byteLength);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    expect(dv.getUint32(z.length - 22, true)).toBe(0x06054b50);
    expect(dv.getUint16(z.length - 12, true)).toBe(2);
    // CRC32 of "hello"
    expect(dv.getUint32(14, true)).toBe(0x3610a686);
  });
});
