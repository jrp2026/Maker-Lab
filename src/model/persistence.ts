import type { CircuitDoc, PropValue } from './types';
import { getDef } from '../components/registry';
import { adoptDocParts } from '../ai/library';
import { storageKey } from './storageKey';

const AUTOSAVE_KEY = storageKey('autosave');
const PROJECTS_KEY = storageKey('projects');

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode / quota) */
  }
}

/** Validate & normalise untrusted JSON into a circuit document. */
/**
 * Boards saved before the "USB cable" setting existed were always powered: keep them plugged in
 * even where the default is now unplugged (the ESP32), so old circuits and share links still run.
 */
function withLegacyUsb(defaults: Record<string, PropValue>, saved: Record<string, PropValue>): Record<string, PropValue> {
  const props = { ...defaults, ...saved };
  if ('usb' in defaults && !('usb' in saved)) props.usb = 1;
  return props;
}

export function parseDoc(json: unknown): CircuitDoc {
  const d = json as Partial<CircuitDoc>;
  if (!d || typeof d !== 'object' || !Array.isArray(d.components) || !Array.isArray(d.wires)) throw new Error('Not a circuit file');
  // AI parts must be registered before their instances can be recognised
  const customParts = adoptDocParts(d.customParts);
  const components = d.components
    .filter((c) => c && typeof c.id === 'string' && getDef(String(c.type)))
    .map((c) => {
      const def = getDef(c.type)!;
      return {
        id: String(c.id),
        type: String(c.type),
        x: Number(c.x) || 0,
        y: Number(c.y) || 0,
        rot: ([0, 1, 2, 3].includes(Number(c.rot)) ? Number(c.rot) : 0) as 0 | 1 | 2 | 3,
        flip: !!c.flip,
        props: withLegacyUsb(def.defaultProps, c.props && typeof c.props === 'object' ? c.props : {}),
      };
    });
  const ids = new Set(components.map((c) => c.id));
  const wires = d.wires
    .filter((w) => w && w.a && w.b && ids.has(w.a.comp) && ids.has(w.b.comp))
    .map((w) => ({
      id: String(w.id),
      a: { comp: String(w.a.comp), pin: String(w.a.pin) },
      b: { comp: String(w.b.comp), pin: String(w.b.pin) },
      points: Array.isArray(w.points) ? w.points.map((p) => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 })) : [],
      color: typeof w.color === 'string' ? w.color : '#43a047',
    }));
  const used = new Set(components.map((c) => c.type));
  const doc: CircuitDoc = { version: 1, name: typeof d.name === 'string' ? d.name : 'Imported circuit', components, wires };
  const parts = customParts.filter((p) => used.has(p.type));
  if (parts.length) doc.customParts = parts;
  return doc;
}

export function autosave(doc: CircuitDoc) {
  safeSet(AUTOSAVE_KEY, JSON.stringify(doc));
}

export function loadAutosave(): CircuitDoc | null {
  const raw = safeGet(AUTOSAVE_KEY);
  if (!raw) return null;
  try {
    return parseDoc(JSON.parse(raw));
  } catch {
    return null;
  }
}

export interface SavedProject {
  name: string;
  savedAt: number;
  doc: CircuitDoc;
}

export function listProjects(): SavedProject[] {
  try {
    const all = JSON.parse(safeGet(PROJECTS_KEY) ?? '{}') as Record<string, SavedProject>;
    return Object.values(all).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export function saveProject(doc: CircuitDoc) {
  let all: Record<string, SavedProject> = {};
  try {
    all = JSON.parse(safeGet(PROJECTS_KEY) ?? '{}');
  } catch {
    /* start fresh */
  }
  all[doc.name] = { name: doc.name, savedAt: Date.now(), doc };
  safeSet(PROJECTS_KEY, JSON.stringify(all));
}

function readProjects(): Record<string, SavedProject> {
  try {
    return JSON.parse(safeGet(PROJECTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** "Robot (2)" if "Robot" is taken */
export function uniqueProjectName(base: string): string {
  const all = readProjects();
  if (!all[base]) return base;
  const stem = base.replace(/ \(\d+\)$/, '');
  for (let n = 2; ; n++) if (!all[`${stem} (${n})`]) return `${stem} (${n})`;
}

/** Rename a saved project; false if the new name is taken. */
export function renameProject(from: string, to: string): boolean {
  const all = readProjects();
  if (!all[from] || (to !== from && all[to])) return false;
  const p = all[from];
  delete all[from];
  all[to] = { ...p, name: to, doc: { ...p.doc, name: to } };
  safeSet(PROJECTS_KEY, JSON.stringify(all));
  return true;
}

/** Copy a saved project under a new name; returns the copy's name. */
export function duplicateProject(name: string): string | null {
  const all = readProjects();
  const p = all[name];
  if (!p) return null;
  const copy = uniqueProjectName(`${name} (copy)`);
  all[copy] = { name: copy, savedAt: Date.now(), doc: { ...structuredClone(p.doc), name: copy } };
  safeSet(PROJECTS_KEY, JSON.stringify(all));
  return copy;
}

export function deleteProject(name: string) {
  try {
    const all = JSON.parse(safeGet(PROJECTS_KEY) ?? '{}');
    delete all[name];
    safeSet(PROJECTS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fileSafe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'circuit';

export function exportJson(doc: CircuitDoc) {
  download(`${fileSafe(doc.name)}.circuit.json`, new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }));
}

export async function importJson(file: File): Promise<CircuitDoc> {
  return parseDoc(JSON.parse(await file.text()));
}

// ---- share links: deflate + base64url in the URL hash

function toB64Url(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(str: string) {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function shareLink(doc: CircuitDoc): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(doc));
  const packed = typeof CompressionStream !== 'undefined' ? 'z' + toB64Url(await pipe(raw, new CompressionStream('deflate-raw'))) : 'j' + toB64Url(raw);
  const url = new URL(location.href);
  url.hash = `circuit=${packed}`;
  return url.toString();
}

export async function docFromHash(hash: string): Promise<CircuitDoc | null> {
  const m = /circuit=([zj])([\w-]+)/.exec(hash);
  if (!m) return null;
  let bytes = fromB64Url(m[2]);
  if (m[1] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  return parseDoc(JSON.parse(new TextDecoder().decode(bytes)));
}

// ---- PNG export of the current canvas contents

export async function exportPng(svg: SVGSVGElement, bounds: { x: number; y: number; w: number; h: number }, name: string) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('.pins, .wire-hit, .flow, .handle, .bg, .marquee, .warn-badge .pulse').forEach((el) => el.remove());
  const world = clone.querySelector(':scope > g') as SVGGElement | null;
  world?.removeAttribute('transform');
  const pad = 30;
  const vb = { x: bounds.x - pad, y: bounds.y - pad, w: bounds.w + pad * 2, h: bounds.h + pad * 2 };
  clone.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const scale = Math.min(3, 2400 / vb.w);
  clone.setAttribute('width', String(vb.w * scale));
  clone.setAttribute('height', String(vb.h * scale));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  Object.entries({ x: vb.x, y: vb.y, width: vb.w, height: vb.h, fill: '#f7f8fa' }).forEach(([k, v]) => bg.setAttribute(k, String(v)));
  clone.insertBefore(bg, world);
  const text = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('Could not render image'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vb.w * scale);
  canvas.height = Math.round(vb.h * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
  if (blob) download(`${fileSafe(name)}.png`, blob);
}
