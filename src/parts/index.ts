/**
 * Built-in parts authored as declarative specs (the same format the AI generator
 * produces), validated at start-up and turned into ComponentDefs.
 */
import { validateSpec, SpecError } from '../ai/spec';
import { defFromSpec } from '../ai/customPart';
import type { ComponentDef } from '../components/types';
import { PASSIVE } from './passive';
import { SEMIS } from './semis';
import { RELAYS, SWITCHES } from './switches';

export const RAW_PARTS = [...PASSIVE, ...SEMIS, ...SWITCHES, ...RELAYS];

export function buildSpecParts(): ComponentDef[] {
  const out: ComponentDef[] = [];
  for (const raw of RAW_PARTS) {
    try {
      out.push(defFromSpec(validateSpec(raw, { builtin: true })));
    } catch (e) {
      const why = e instanceof SpecError ? e.problems.join('; ') : String(e);
      throw new Error(`built-in part '${raw.type}' is invalid: ${why}`);
    }
  }
  return out;
}
