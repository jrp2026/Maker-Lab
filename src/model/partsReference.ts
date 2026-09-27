/**
 * Generates docs/parts-reference.md: every part type with its pins and settings, written for an
 * LLM that has to produce a project JSON. Kept in sync by tests/docs.test.ts
 * (regenerate with `npm run docs`).
 */
import { DEFS } from '../components/registry';
import type { ComponentDef, PropField } from '../components/types';
import type { PropValue } from './types';

const CATEGORY_TITLES: Record<string, string> = {
  boards: 'Prototyping surfaces', mcu: 'Microcontroller boards', passive: 'Passive components', diodes: 'Diodes & LEDs',
  transistors: 'Transistors', switches: 'Switches & inputs', power: 'Power', output: 'Outputs (motors, sound, lights)',
  drivers: 'Motor & driver modules', ics: 'Analog & timer ICs', gates: 'Logic gates', logic: 'Logic ICs', memory: 'Memory & time', sensors: 'Sensors',
  displays: 'Displays', comms: 'Communication modules', instruments: 'Instruments',
};
const ORDER = Object.keys(CATEGORY_TITLES);

/** props that belong to the editor, not to the circuit */
const HIDDEN_PROPS = new Set(['blocks', 'codeMode']);

const md = (s: string) => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
const val = (v: PropValue) => (typeof v === 'string' ? JSON.stringify(v) : String(v));

function propLine(key: string, def: PropValue, field?: PropField): string {
  if (key === 'code') return '`code` — the Arduino sketch (a string of C++ source)';
  let s = `\`${key}\` = ${val(def)}`;
  if (!field) return s;
  s += ` — ${md(field.label)}`;
  if (field.kind === 'select') s += `; one of ${field.options.map((o) => `${val(o.value)} (${md(o.label)})`).join(', ')}`;
  else if (field.kind === 'slider') s += `; ${field.min}…${field.max}${field.unit ? ` ${field.unit}` : ''}`;
  else if (field.kind === 'number') s += `; number${field.unit ? ` in ${field.unit}` : ''}${field.min !== undefined ? `, ≥ ${field.min}` : ''}`;
  else if (field.kind === 'bool') s += '; true / false';
  return s;
}

function partSection(def: ComponentDef): string {
  const pins = def.pins(def.defaultProps);
  const lines = [`#### \`${def.type}\` — ${md(def.name)}`, '', md(def.description.split('\n')[0]), ''];
  if (def.category === 'boards') {
    lines.push(`Pins: ${pins.length} sockets (see "Breadboards" in the guide for the naming scheme, e.g. ${pins.slice(0, 3).map((p) => `\`${p.id}\``).join(', ')}).`);
  } else {
    const label = (id: string, l: string) => (l && l !== id ? `\`${id}\` (${md(l)})` : `\`${id}\``);
    lines.push(`Pins: ${pins.map((p) => label(p.id, p.label ?? '')).join(', ')}`);
  }
  const fields = new Map((def.fields ?? []).map((f) => [f.key, f]));
  const props = Object.entries(def.defaultProps).filter(([k]) => !HIDDEN_PROPS.has(k));
  if (props.length) {
    lines.push('', 'Props:');
    for (const [k, v] of props) lines.push(`- ${propLine(k, v, fields.get(k))}`);
  }
  const groups = def.category === 'boards' ? [] : (def.internalConnections?.(def.defaultProps) ?? []);
  if (groups.length) lines.push('', `Internally connected: ${groups.map((g) => g.map((p) => `\`${p}\``).join(' = ')).join('; ')}`);
  return lines.join('\n');
}

export function partsReferenceMarkdown(): string {
  const defs = [...DEFS].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category) || a.type.localeCompare(b.type));
  const out = [
    '# MakerLab parts reference',
    '',
    `Every part type MakerLab knows (${defs.length}), with its exact pin ids and props. Use these ids verbatim in a`,
    'project JSON — see [llm-project-json.md](llm-project-json.md) for the file format. This file is generated from the',
    'part definitions (`npm run docs`); do not edit it by hand.',
    '',
    '## Index',
    '',
  ];
  for (const cat of ORDER) {
    const inCat = defs.filter((d) => d.category === cat);
    if (inCat.length) out.push(`- **${CATEGORY_TITLES[cat]}**: ${inCat.map((d) => `\`${d.type}\``).join(', ')}`);
  }
  for (const cat of ORDER) {
    const inCat = defs.filter((d) => d.category === cat);
    if (!inCat.length) continue;
    out.push('', `## ${CATEGORY_TITLES[cat]}`, '');
    for (const d of inCat) out.push(partSection(d), '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
