/** KiCad downloads (loaded on demand from the File menu / inspector / AI part dialog). */
import type { CircuitDoc, Props } from '../model/types';
import type { ComponentDef } from '../components/types';
import { exportKicad } from './schematic';
import { buildFootprint, buildSymbol, footprintName, symbolLibrary } from './parts';
import { zip } from './zip';

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The whole circuit as a zipped KiCad project; returns a short summary for a toast. */
export function downloadKicadProject(doc: CircuitDoc): string {
  const out = exportKicad(doc);
  const folder = Object.keys(out.files)[0].split('/')[0];
  download(`${folder}-kicad.zip`, zip(out.files) as BlobPart, 'application/zip');
  const left = out.skipped.length ? ` (left out: ${[...new Set(out.skipped)].join(', ')})` : '';
  return `KiCad project: ${out.parts} parts, ${out.nets} nets${left}`;
}

const symName = (def: ComponentDef) => def.type.replace(/[^A-Za-z0-9_.+-]+/g, '_');

export function downloadSymbol(def: ComponentDef, props: Props) {
  const sym = buildSymbol(def, props, symName(def));
  download(`${symName(def)}.kicad_sym`, symbolLibrary([sym.text]), 'text/plain');
}

export function downloadFootprint(def: ComponentDef, props: Props) {
  download(`${footprintName(def, props)}.kicad_mod`, buildFootprint(def, props), 'text/plain');
}
