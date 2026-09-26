import { describe, expect, it } from 'vitest';
import { createElement, Fragment, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFS } from '../src/components/registry';
import { boundsOf } from '../src/components/types';
import { Simulator } from '../src/sim/simulator';
import type { CircuitDoc } from '../src/model/types';
import { buildNetlist } from '../src/sim/netlist';

/** Fully render a part's SVG (every nested component runs, unlike calling render() alone). */
const markup = (el: unknown, prefix: string) => renderToStaticMarkup(el as ReactElement, { identifierPrefix: prefix });

/** gradients the canvas defines once for everything it draws */
const CANVAS_DEFS = /^(bbShade|glow-.*)$/;

/** Every url(#id) must point at an id defined in the same drawing, and ids must be unique. */
function checkRefs(svg: string) {
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const refs = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]).filter((r) => !CANVAS_DEFS.test(r));
  return {
    duplicates: ids.filter((id, i) => ids.indexOf(id) !== i),
    dangling: refs.filter((r) => !ids.includes(r)),
  };
}

describe('part artwork', () => {
  it.each(DEFS.map((d) => [d.type, d] as const))('%s draws cleanly in both views, idle and simulating', (type, def) => {
    const comp = { id: 'p', type, x: 0, y: 0, rot: 0 as const, flip: false, props: { ...def.defaultProps } };
    const views: [string, string][] = [
      ['breadboard', markup(def.render({ comp, props: comp.props }), 'a')],
      ['schematic', markup(def.schematic({ comp, props: comp.props }), 'b')],
    ];
    // and with a real simulation frame (readouts, glows, overlays, animations)
    const doc: CircuitDoc = { version: 1, name: 't', components: [comp], wires: [] };
    const sim = new Simulator(doc);
    sim.start();
    for (let i = 0; i < 3; i++) sim.advance(0.02);
    const frame = sim.snapshot().comps.p;
    if (frame) views.push(['simulating', markup(def.render({ comp, props: comp.props, sim: frame }), 'c')]);

    for (const [view, svg] of views) {
      // prototyping surfaces have no schematic symbol
      if (view === 'schematic' && def.category === 'boards') continue;
      expect(svg.length, `${view} is empty`).toBeGreaterThan(20);
      expect(svg, `${view} contains NaN`).not.toMatch(/NaN|undefined|Infinity/);
      const { duplicates, dangling } = checkRefs(svg);
      expect(duplicates, `${view}: duplicate ids`).toEqual([]);
      expect(dangling, `${view}: url(#…) to a missing gradient`).toEqual([]);
    }
  });

  it.each(DEFS.map((d) => [d.type, d] as const))('%s keeps every pin inside its bounds', (_type, def) => {
    const b = boundsOf(def, def.defaultProps);
    expect(Number.isFinite(b.x + b.y + b.w + b.h)).toBe(true);
    for (const p of def.pins(def.defaultProps)) {
      expect(p.x, `pin ${p.id} x`).toBeGreaterThanOrEqual(b.x - 5);
      expect(p.x, `pin ${p.id} x`).toBeLessThanOrEqual(b.x + b.w + 5);
      expect(p.y, `pin ${p.id} y`).toBeGreaterThanOrEqual(b.y - 5);
      expect(p.y, `pin ${p.id} y`).toBeLessThanOrEqual(b.y + b.h + 5);
    }
  });

  it('pins sit on the 0.1" grid so legs drop into breadboard / perfboard holes', () => {
    // parts snap to 10-unit positions, and a lead joins a socket only at exactly the same point
    const off: string[] = [];
    for (const def of DEFS)
      for (const p of def.pins(def.defaultProps)) if (Math.abs(p.x % 10) > 1e-6 || Math.abs(p.y % 10) > 1e-6) off.push(`${def.type}.${p.id} (${p.x}, ${p.y})`);
    expect(off).toEqual([]);
  });

  it.each([['perfboard', false], ['stripboard', true]] as const)('a resistor dropped on the %s plugs its legs into the holes', (type, strips) => {
    // board at (100, 200): hole A1 is at (110, 210); the resistor's legs are 40 apart (A1 and A5)
    const doc: CircuitDoc = {
      version: 1, name: 't', wires: [],
      components: [
        { id: 'b', type, x: 100, y: 200, rot: 0, flip: false, props: {} },
        { id: 'r', type: 'resistor', x: 110, y: 210, rot: 0, flip: false, props: { resistance: 1000 } },
        { id: 'l', type: 'resistor', x: 150, y: 210, rot: 0, flip: false, props: { resistance: 1000 } },
      ],
    };
    const nl = buildNetlist(doc);
    const net = (k: string) => nl.netOf.get(k);
    expect(net('r:1')).toBe(net('b:A1'));
    expect(net('r:2')).toBe(net('b:A5'));
    // perfboard holes are separate; stripboard rows are one copper strip
    expect(net('r:1') === net('r:2')).toBe(strips);
    expect(net('l:1')).toBe(net('b:A5'));
  });

  it('every library thumbnail can share one page: no id collides, every url(#…) resolves', () => {
    // the library draws all parts at once, each with the same instance id ('thumb')
    const thumbs = DEFS.map((def) => {
      const comp = { id: 'thumb', type: def.type, x: 0, y: 0, rot: 0 as const, flip: false, props: { ...def.defaultProps } };
      return createElement('svg', { key: def.type }, def.render({ comp, props: comp.props }) as ReactElement);
    });
    const svg = renderToStaticMarkup(createElement(Fragment, null, ...thumbs));
    const { duplicates, dangling } = checkRefs(svg);
    expect([...new Set(duplicates)]).toEqual([]);
    expect(dangling).toEqual([]);
  });
});
