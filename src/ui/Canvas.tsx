import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CircuitDoc, ComponentInstance, PinRef, Point } from '../model/types';
import { getDef } from '../components/registry';
import { boundsOf } from '../components/types';
import { snap, worldBounds, worldPins, type WorldPin } from '../model/geometry';
import {
  addComponent, addWire, beginGesture, endGesture, moveComponents, select, setProp, updateWire, useEditor,
} from '../model/store';
import { buildNetlist } from '../sim/netlist';
import { getSimulator, useSimView } from '../sim/controller';
import { ComponentView, WarningBadge, WireView, pinWorld, wirePath } from './ComponentView';
import { setCanvasSize, useViewport, zoomBy } from './viewport';
import { SchematicNets } from './SchematicNets';
import { LED_COLORS, formatSI } from '../components/util';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: 'move'; ids: string[]; start: Point; base: CircuitDoc; moved: boolean }
  | { kind: 'marquee'; start: Point; cur: Point }
  | { kind: 'handle'; wire: string; index: number }
  | { kind: 'wireEnd'; wire: string; end: 'a' | 'b'; cur: Point }
  | { kind: 'press'; comp: string }
  /** two fingers: zoom about their midpoint and pan with it */
  | { kind: 'pinch'; d0: number; mx: number; my: number; vp: { x: number; y: number; s: number } }
  | { kind: 'knob'; comp: string; key: string; startY: number; startVal: number; lo: number; hi: number }
  /** a part that is both pushed and turned (encoder, joystick): holding still presses, moving turns */
  | { kind: 'pressOrKnob'; comp: string; knob: Extract<Drag, { kind: 'knob' }>; startX: number; pressed: boolean; timer: number };

/** turning a part's knob by dragging up/down, over the range of its inspector field */
function knobDrag(comp: ComponentInstance, key: string, clientY: number): Extract<Drag, { kind: 'knob' }> {
  const def = getDef(comp.type)!;
  const f = def.fields?.find((x) => x.key === key);
  const lo = f && 'min' in f && f.min !== undefined ? f.min : 0;
  const hi = f && 'max' in f && f.max !== undefined ? f.max : 1;
  return { kind: 'knob', comp: comp.id, key, startY: clientY, startVal: Number(comp.props[key]), lo, hi };
}

interface Draft {
  from: PinRef;
  fromPos: Point;
  points: Point[];
  cursor: Point;
  dragging: boolean;
  downAt: Point;
}

interface PinInfo extends WorldPin {
  comp: ComponentInstance;
  board: boolean;
}

function hitAt(clientX: number, clientY: number): { kind?: string; id?: string; pin?: string; index?: string; end?: string } {
  const el = document.elementFromPoint(clientX, clientY)?.closest('[data-kind]') as HTMLElement | SVGElement | null;
  if (!el) return {};
  const ds = (el as HTMLElement).dataset;
  return { kind: ds.kind, id: ds.id, pin: ds.pin, index: ds.index, end: ds.end };
}

export function Canvas() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const view = useEditor((s) => s.view);
  const running = useEditor((s) => s.running);
  const vp = useViewport();
  const snapState = useSimView((s) => s.snap);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  /** fingers currently on the canvas (for pinch zoom) */
  const touches = useRef(new Map<number, { x: number; y: number }>());
  /** a pinch happened: the fingers still down do nothing until they are all lifted */
  const pinched = useRef(false);
  const pinchStart = (): Drag => {
    const [a, b] = [...touches.current.values()];
    const r = svgRef.current!.getBoundingClientRect();
    return { kind: 'pinch', d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2 - r.left, my: (a.y + b.y) / 2 - r.top, vp: { ...useViewport.getState() } };
  };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [marquee, setMarquee] = useState<{ a: Point; b: Point } | null>(null);
  const [hover, setHover] = useState<{ comp: string; pin: string; x: number; y: number } | null>(null);
  const [wireEndDrag, setWireEndDrag] = useState<{ wire: string; end: 'a' | 'b'; cur: Point } | null>(null);

  const compById = useMemo(() => new Map(doc.components.map((c) => [c.id, c])), [doc.components]);
  const netlist = useMemo(() => buildNetlist(doc), [doc]);
  const pins = useMemo(() => {
    const out: PinInfo[] = [];
    for (const c of doc.components) {
      const def = getDef(c.type);
      if (!def) continue;
      if (view === 'schematic' && def.layer === 0) continue;
      for (const p of worldPins(c, def)) out.push({ ...p, comp: c, board: def.layer === 0 });
    }
    return out;
  }, [doc.components, view]);

  // ---------------------------------------------------------------- coordinates
  const toWorld = useCallback((cx: number, cy: number): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    const v = useViewport.getState();
    return { x: (cx - r.left - v.x) / v.s, y: (cy - r.top - v.y) / v.s };
  }, []);

  useEffect(() => {
    const el = svgRef.current!;
    // record the size now: the first zoom-to-fit runs before the observer's first callback
    const r0 = el.getBoundingClientRect();
    setCanvasSize(r0.width, r0.height);
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setCanvasSize(r.width, r.height);
    });
    ro.observe(el);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
      } else {
        const v = useViewport.getState();
        useViewport.setState({ x: v.x - e.deltaX, y: v.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDraft(null);
        drag.current = null;
        setMarquee(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------------------------------------------------------------- pointer handling
  const finishWire = (d: Draft, to: PinRef) => {
    if (to.comp === d.from.comp && to.pin === d.from.pin) return false;
    addWire(d.from, to, d.points);
    setDraft(null);
    return true;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return;
    if (e.pointerType === 'touch') {
      // the first finger of a new gesture: forget any finger whose lift we never heard about
      if (e.isPrimary) {
        touches.current.clear();
        pinched.current = false;
      }
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        // a second finger turns whatever the first one started into a pinch
        if (drag.current?.kind === 'press') {
          const sim = getSimulator();
          if (sim) sim.input(drag.current.comp).pressed = false;
        }
        if (drag.current?.kind === 'pressOrKnob') window.clearTimeout(drag.current.timer);
        // a part the first finger started moving stays where it got to (one undo step)
        if (drag.current && ['move', 'handle', 'knob', 'wireEnd'].includes(drag.current.kind)) endGesture();
        setWireEndDrag(null);
        setDraft(null);
        setMarquee(null);
        svgRef.current!.setPointerCapture(e.pointerId);
        drag.current = pinchStart();
        pinched.current = true;
        return;
      }
      if (touches.current.size > 2) return;
    }
    const w = toWorld(e.clientX, e.clientY);
    const t = (e.target as Element).closest('[data-kind]') as SVGElement | null;
    const kind = t?.dataset.kind;
    const id = t?.dataset.id;
    svgRef.current!.setPointerCapture(e.pointerId);

    if (e.button === 1 || (e.button === 0 && e.altKey && !kind)) {
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: vp.x, vy: vp.y, moved: true };
      return;
    }

    if (draft) {
      if (kind === 'pin') {
        if (finishWire(draft, { comp: id!, pin: t!.dataset.pin! })) return;
      }
      setDraft({ ...draft, points: [...draft.points, { x: snap(w.x, 5), y: snap(w.y, 5) }], dragging: false });
      return;
    }

    if (kind === 'pin') {
      const pin = t!.dataset.pin!;
      const comp = compById.get(id!)!;
      const pos = pinWorld(comp, pin)!;
      setDraft({ from: { comp: id!, pin }, fromPos: pos, points: [], cursor: w, dragging: true, downAt: w });
      select({});
      return;
    }
    if (kind === 'handle') {
      beginGesture();
      drag.current = { kind: 'handle', wire: id!, index: Number(t!.dataset.index) };
      return;
    }
    if (kind === 'wire-end') {
      beginGesture();
      const end = t!.dataset.end as 'a' | 'b';
      drag.current = { kind: 'wireEnd', wire: id!, end, cur: w };
      setWireEndDrag({ wire: id!, end, cur: w });
      return;
    }
    if (kind === 'wire') {
      select({ wire: id! });
      return;
    }
    if (kind === 'comp' || kind === 'badge') {
      const comp = compById.get(id!);
      if (!comp) return;
      const def = getDef(comp.type)!;
      if (running && def.interactive && kind === 'comp') {
        if (def.interactive === 'press' && def.dragKey) {
          const knob = knobDrag(comp, def.dragKey, e.clientY);
          const d: Extract<Drag, { kind: 'pressOrKnob' }> = { kind: 'pressOrKnob', comp: comp.id, knob, startX: e.clientX, pressed: false, timer: 0 };
          // held still for a moment → it's a press
          d.timer = window.setTimeout(() => {
            if (drag.current !== d) return;
            d.pressed = true;
            const sim = getSimulator();
            if (sim) sim.input(comp.id).pressed = true;
          }, 180);
          drag.current = d;
          select({ comps: [comp.id] });
        } else if (def.interactive === 'press') {
          const sim = getSimulator();
          if (sim) sim.input(comp.id).pressed = true;
          drag.current = { kind: 'press', comp: comp.id };
        } else if (def.interactive === 'toggle') {
          if (comp.type === 'multimeter') {
            const order = ['V', 'A', 'R'];
            setProp(comp.id, 'mode', order[(order.indexOf(String(comp.props.mode)) + 1) % order.length]);
          } else {
            const key = def.toggleKey ?? 'position';
            setProp(comp.id, key, Number(comp.props[key]) === 1 ? 0 : 1);
          }
          select({ comps: [comp.id] });
        } else if (def.interactive === 'drag') {
          beginGesture();
          drag.current = knobDrag(comp, def.dragKey ?? (comp.type === 'photoresistor' ? 'light' : 'position'), e.clientY);
          select({ comps: [comp.id] });
        }
        return;
      }
      let ids = selection.comps;
      if (e.shiftKey) {
        ids = ids.includes(comp.id) ? ids.filter((x) => x !== comp.id) : [...ids, comp.id];
        select({ comps: ids });
        return;
      }
      if (!ids.includes(comp.id)) {
        ids = [comp.id];
        select({ comps: ids });
      }
      beginGesture();
      drag.current = { kind: 'move', ids, start: w, base: doc, moved: false };
      return;
    }
    // background
    if (e.shiftKey) {
      drag.current = { kind: 'marquee', start: w, cur: w };
      setMarquee({ a: w, b: w });
    } else {
      drag.current = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: vp.x, vy: vp.y, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' && touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const w = toWorld(e.clientX, e.clientY);
    const d = drag.current;
    if (d?.kind === 'pinch') {
      const [a, b] = [...touches.current.values()];
      if (!a || !b) return;
      const r = svgRef.current!.getBoundingClientRect();
      const s = Math.max(0.25, Math.min(6, d.vp.s * Math.hypot(a.x - b.x, a.y - b.y) / d.d0));
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      // the world point that was under the fingers stays under them
      const wx = (d.mx - d.vp.x) / d.vp.s, wy = (d.my - d.vp.y) / d.vp.s;
      useViewport.setState({ s, x: mx - wx * s, y: my - wy * s });
      return;
    }
    if (draft) setDraft((x) => (x ? { ...x, cursor: w } : x));
    if (!d) {
      const h = hitAt(e.clientX, e.clientY);
      if (h.kind === 'pin') {
        if (!hover || hover.comp !== h.id || hover.pin !== h.pin) setHover({ comp: h.id!, pin: h.pin!, x: e.clientX, y: e.clientY });
      } else if (hover) setHover(null);
      return;
    }
    switch (d.kind) {
      case 'pan': {
        const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
        useViewport.setState({ x: d.vx + dx, y: d.vy + dy });
        break;
      }
      case 'move': {
        const dx = w.x - d.start.x, dy = w.y - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) * vp.s < 3) return;
        d.moved = true;
        moveComponents(d.ids, dx, dy, d.base);
        break;
      }
      case 'marquee':
        d.cur = w;
        setMarquee({ a: d.start, b: w });
        break;
      case 'handle': {
        const wire = doc.wires.find((x) => x.id === d.wire);
        if (!wire) return;
        const points = wire.points.slice();
        points[d.index] = { x: snap(w.x, 5), y: snap(w.y, 5) };
        updateWire(d.wire, { points });
        break;
      }
      case 'wireEnd':
        d.cur = w;
        setWireEndDrag({ wire: d.wire, end: d.end, cur: w });
        break;
      case 'pressOrKnob':
        // moved before the press kicked in → turn the knob instead
        if (!d.pressed && Math.hypot(e.clientX - d.startX, e.clientY - d.knob.startY) > 4) {
          window.clearTimeout(d.timer);
          beginGesture();
          drag.current = d.knob;
        }
        break;
      case 'knob': {
        const span = d.hi - d.lo;
        const v = Math.max(d.lo, Math.min(d.hi, d.startVal + ((d.startY - e.clientY) / 150) * span));
        setProp(d.comp, d.key, Math.round(((v - d.lo) / span) * 200) / 200 * span + d.lo);
        break;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId);
    if (pinched.current) {
      // lifting a finger ends the pinch; the others do nothing more until lifted
      drag.current = null;
      if (!touches.current.size) pinched.current = false;
      return;
    }
    const d = drag.current;
    drag.current = null;
    const w = toWorld(e.clientX, e.clientY);
    if (draft && draft.dragging) {
      const h = hitAt(e.clientX, e.clientY);
      const moved = Math.hypot(w.x - draft.downAt.x, w.y - draft.downAt.y) * vp.s > 6;
      if (h.kind === 'pin' && finishWire(draft, { comp: h.id!, pin: h.pin! })) return;
      if (moved) setDraft({ ...draft, points: [...draft.points, { x: snap(w.x, 5), y: snap(w.y, 5) }], dragging: false });
      else setDraft({ ...draft, dragging: false });
      return;
    }
    if (!d) return;
    switch (d.kind) {
      case 'pan':
        if (!d.moved) select({});
        break;
      case 'move':
      case 'handle':
      case 'knob':
        endGesture();
        break;
      case 'marquee': {
        const x0 = Math.min(d.start.x, d.cur.x), x1 = Math.max(d.start.x, d.cur.x);
        const y0 = Math.min(d.start.y, d.cur.y), y1 = Math.max(d.start.y, d.cur.y);
        const ids = doc.components
          .filter((c) => {
            const def = getDef(c.type);
            if (!def || (view === 'schematic' && def.layer === 0)) return false;
            const b = worldBounds(c, def);
            return b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0;
          })
          .map((c) => c.id);
        select({ comps: ids });
        setMarquee(null);
        break;
      }
      case 'wireEnd': {
        const h = hitAt(e.clientX, e.clientY);
        if (h.kind === 'pin') updateWire(d.wire, { [d.end]: { comp: h.id!, pin: h.pin! } });
        endGesture();
        setWireEndDrag(null);
        break;
      }
      case 'press': {
        const sim = getSimulator();
        if (sim) sim.input(d.comp).pressed = false;
        break;
      }
      case 'pressOrKnob': {
        window.clearTimeout(d.timer);
        const sim = getSimulator();
        if (!sim) break;
        if (d.pressed) sim.input(d.comp).pressed = false;
        else {
          // a quick click: a short press
          sim.input(d.comp).pressed = true;
          window.setTimeout(() => (sim.input(d.comp).pressed = false), 150);
        }
        break;
      }
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const t = (e.target as Element).closest('[data-kind]') as SVGElement | null;
    if (!t) return;
    const w = toWorld(e.clientX, e.clientY);
    if (t.dataset.kind === 'handle') {
      const wire = doc.wires.find((x) => x.id === t.dataset.id);
      if (wire) updateWire(wire.id, { points: wire.points.filter((_, i) => i !== Number(t.dataset.index)) });
    } else if (t.dataset.kind === 'wire') {
      // insert a bend point on the nearest segment
      const wire = doc.wires.find((x) => x.id === t.dataset.id);
      if (!wire) return;
      const pts = wirePoints(wire.id);
      if (!pts) return;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < pts.length - 1; i++) {
        const dd = segDist(w, pts[i], pts[i + 1]);
        if (dd < bestD) {
          bestD = dd;
          best = i;
        }
      }
      const points = wire.points.slice();
      points.splice(best, 0, { x: snap(w.x, 5), y: snap(w.y, 5) });
      updateWire(wire.id, { points });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData('text/x-component');
    if (!type) return;
    e.preventDefault();
    const def = getDef(type);
    if (!def) return;
    const w = toWorld(e.clientX, e.clientY);
    const b = boundsOf(def, def.defaultProps);
    addComponent(type, w.x - (b.x + b.w / 2), w.y - (b.y + b.h / 2));
  };

  // ---------------------------------------------------------------- derived render data
  function wirePoints(id: string): Point[] | null {
    const wire = doc.wires.find((x) => x.id === id);
    if (!wire) return null;
    const ca = compById.get(wire.a.comp), cb = compById.get(wire.b.comp);
    if (!ca || !cb) return null;
    let a = pinWorld(ca, wire.a.pin), b = pinWorld(cb, wire.b.pin);
    if (!a || !b) return null;
    if (wireEndDrag?.wire === id) {
      if (wireEndDrag.end === 'a') a = wireEndDrag.cur;
      else b = wireEndDrag.cur;
    }
    return [a, ...wire.points, b];
  }

  const warningsByComp = useMemo(() => {
    const m = new Map<string, { level: 'error' | 'warn'; messages: string[] }>();
    for (const w of snapState?.warnings ?? []) {
      if (!w.comp) continue;
      const cur = m.get(w.comp) ?? { level: 'warn' as const, messages: [] };
      if (w.level === 'error') cur.level = 'error';
      cur.messages.push(w.message);
      m.set(w.comp, cur);
    }
    return m;
  }, [snapState?.warnings]);

  const hoverNet = hover ? netlist.netOf.get(`${hover.comp}:${hover.pin}`) : undefined;
  const hoverNetPins = useMemo(() => {
    if (hoverNet === undefined) return [];
    const keys = new Set(netlist.nets[hoverNet]);
    return pins.filter((p) => keys.has(`${p.comp.id}:${p.id}`));
  }, [hoverNet, netlist, pins]);

  const selectedComps = new Set(selection.comps);
  const boards = doc.components.filter((c) => getDef(c.type)?.layer === 0);
  const parts = doc.components.filter((c) => getDef(c.type)?.layer !== 0);
  const selectedWire = selection.wire ? doc.wires.find((w) => w.id === selection.wire) : undefined;

  const hoverInfo = (() => {
    if (!hover) return null;
    const comp = compById.get(hover.comp);
    if (!comp) return null;
    const def = getDef(comp.type)!;
    const p = def.pins(comp.props).find((x) => x.id === hover.pin);
    let volts: string | null = null;
    if (snapState) {
      const net = snapState.netOfPin.get(`${hover.comp}:${hover.pin}`);
      const v = net !== undefined ? snapState.netVolts[net] : NaN;
      if (Number.isFinite(v)) volts = formatSI(v, 'V', 3);
    }
    return { title: def.layer === 0 ? def.name : `${def.name}`, label: p?.label ?? hover.pin, volts, x: hover.x, y: hover.y };
  })();

  const cursor = draft ? 'crosshair' : undefined;

  return (
    <div className="canvas-wrap" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <svg
        ref={svgRef}
        className={`canvas ${view}`}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onDoubleClick={onDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="grid" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform={`translate(${vp.x} ${vp.y}) scale(${vp.s})`}>
            <circle cx={0} cy={0} r={0.55} fill={view === 'schematic' ? '#c9d6e6' : '#cfd3da'} />
          </pattern>
          <linearGradient id="bbShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#000" stopOpacity="0.04" />
          </linearGradient>
          {Object.entries(LED_COLORS).map(([k, c]) => (
            <radialGradient key={k} id={`glow-${k}`}>
              <stop offset="0" stopColor={c.glow} stopOpacity="0.95" />
              <stop offset="0.35" stopColor={c.glow} stopOpacity="0.45" />
              <stop offset="1" stopColor={c.glow} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        <rect className="bg" x={0} y={0} width="100%" height="100%" fill="url(#grid)" />
        <g transform={`translate(${vp.x} ${vp.y}) scale(${vp.s})`}>
          {/* boards */}
          {boards.map((c) => <ComponentView key={c.id} comp={c} view={view} selected={selectedComps.has(c.id)} running={running} />)}
          {/* sockets (holes) are pin targets under the parts */}
          {view === 'breadboard' && (
            <g className="pins sockets">
              {pins.filter((p) => p.board).map((p) => (
                <rect key={`${p.comp.id}:${p.id}`} x={p.wx - 3.5} y={p.wy - 3.5} width={7} height={7} data-kind="pin" data-id={p.comp.id} data-pin={p.id} className="pin-target" />
              ))}
            </g>
          )}
          {/* plugged indicators */}
          {view === 'breadboard' && (
            <g style={{ pointerEvents: 'none' }}>
              {pins.filter((p) => p.board && netlist.plugged.has(`${p.comp.id}:${p.id}`)).map((p) => (
                <rect key={`pl:${p.comp.id}:${p.id}`} x={p.wx - 2.8} y={p.wy - 2.8} width={5.6} height={5.6} rx={1} fill="none" stroke="#2fbf71" strokeWidth={1} />
              ))}
            </g>
          )}
          {parts.map((c) => <ComponentView key={c.id} comp={c} view={view} selected={selectedComps.has(c.id)} running={running} />)}
          {/* wires */}
          {view === 'breadboard' ? (
            doc.wires.map((wire) => {
              const pts = wirePoints(wire.id);
              if (!pts) return null;
              return <WireView key={wire.id} wire={wire} pts={pts} selected={selection.wire === wire.id} flow={snapState?.wireFlow[wire.id] ?? 0} />;
            })
          ) : (
            <SchematicNets doc={doc} netlist={netlist} />
          )}
          {/* selected wire handles */}
          {view === 'breadboard' && selectedWire && (() => {
            const pts = wirePoints(selectedWire.id);
            if (!pts) return null;
            return (
              <g>
                {selectedWire.points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={3.2} className="handle" data-kind="handle" data-id={selectedWire.id} data-index={i} />
                ))}
                <circle cx={pts[0].x} cy={pts[0].y} r={3.6} className="handle end" data-kind="wire-end" data-id={selectedWire.id} data-end="a" />
                <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={3.6} className="handle end" data-kind="wire-end" data-id={selectedWire.id} data-end="b" />
              </g>
            );
          })()}
          {/* wire being drawn */}
          {draft && (
            <path d={wirePath([draft.fromPos, ...draft.points, draft.cursor])} fill="none" stroke={useEditor.getState().wireColor} strokeWidth={2.6} strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" opacity={0.85} style={{ pointerEvents: 'none' }} />
          )}
          {/* part pins on top */}
          <g className="pins">
            {pins.filter((p) => !p.board).map((p) => (
              <circle key={`${p.comp.id}:${p.id}`} cx={p.wx} cy={p.wy} r={3.4} data-kind="pin" data-id={p.comp.id} data-pin={p.id} className="pin-target" />
            ))}
          </g>
          {/* hovered net */}
          {hoverNetPins.length > 0 && (
            <g style={{ pointerEvents: 'none' }}>
              {hoverNetPins.map((p) => (
                <circle key={`h:${p.comp.id}:${p.id}`} cx={p.wx} cy={p.wy} r={p.comp.id === hover?.comp && p.id === hover?.pin ? 4.2 : 3} fill={p.comp.id === hover?.comp && p.id === hover?.pin ? 'rgba(47,191,113,.35)' : 'rgba(47,191,113,.18)'} stroke="#2fbf71" strokeWidth={1.1} />
              ))}
            </g>
          )}
          {/* warnings */}
          {[...warningsByComp].map(([id, w]) => {
            const c = compById.get(id);
            return c ? <WarningBadge key={id} comp={c} level={w.level} messages={w.messages} /> : null;
          })}
          {marquee && (
            <rect x={Math.min(marquee.a.x, marquee.b.x)} y={Math.min(marquee.a.y, marquee.b.y)} width={Math.abs(marquee.a.x - marquee.b.x)} height={Math.abs(marquee.a.y - marquee.b.y)} className="marquee" />
          )}
        </g>
      </svg>
      {hoverInfo && !drag.current && (
        <div className="pin-tip" style={{ left: hoverInfo.x + 14, top: hoverInfo.y + 12 }}>
          <b>{hoverInfo.label}</b>
          <span>{hoverInfo.title}</span>
          {hoverInfo.volts && <em>{hoverInfo.volts}</em>}
        </div>
      )}
      {draft && (
        <div className="canvas-hint">
          <span className="hint-mouse">Click a pin to finish the wire · click empty space to add a bend · Esc to cancel</span>
          <span className="hint-touch">Tap a pin to finish · tap empty space to bend</span>
          <button className="hint-cancel" onClick={() => setDraft(null)}>✕ Cancel</button>
        </div>
      )}
      {!doc.components.length && (
        <div className="empty-state">
          <div className="empty-card">
            <h2>Start building</h2>
            <p>Drag parts from the <b>Components</b> panel onto the canvas, or open an example from the <b>Examples</b> menu.</p>
            <p className="muted">Click a pin to start a wire, click another pin to finish it. Press <kbd>R</kbd> to rotate.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function segDist(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

