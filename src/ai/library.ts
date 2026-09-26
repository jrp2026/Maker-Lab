import { create } from 'zustand';
import type { CustomPartSpec } from './spec';
import { validateSpec } from './spec';
import { defFromSpec } from './customPart';
import { registerDef } from '../components/registry';
import { storageKey } from '../model/storageKey';

const KEY = storageKey('aiParts');

interface AiLib {
  /** parts saved in this browser's "My AI parts" */
  saved: CustomPartSpec[];
  /** every AI part known this session (saved + loaded from documents) */
  known: Record<string, CustomPartSpec>;
}

export const useAiParts = create<AiLib>(() => ({ saved: [], known: {} }));

/** Register a spec so it can be placed and simulated. Returns false if invalid. */
export function registerSpec(spec: CustomPartSpec): boolean {
  try {
    registerDef(defFromSpec(spec));
  } catch {
    return false;
  }
  useAiParts.setState((s) => ({ known: { ...s.known, [spec.type]: spec } }));
  return true;
}

function persist(list: CustomPartSpec[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}

export function savePart(spec: CustomPartSpec) {
  registerSpec(spec);
  const saved = [spec, ...useAiParts.getState().saved.filter((p) => p.type !== spec.type)];
  useAiParts.setState({ saved });
  persist(saved);
}

export function forgetPart(type: string) {
  const saved = useAiParts.getState().saved.filter((p) => p.type !== type);
  useAiParts.setState({ saved });
  persist(saved);
}

export function loadSavedParts() {
  let raw: unknown[] = [];
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    raw = [];
  }
  const saved: CustomPartSpec[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    try {
      const spec = validateSpec(r, { keepType: true });
      if (registerSpec(spec)) saved.push(spec);
    } catch {
      /* skip corrupted entries */
    }
  }
  useAiParts.setState({ saved });
}

/** Validate + register the parts embedded in a document; returns the clean list. */
export function adoptDocParts(parts: unknown): CustomPartSpec[] {
  const out: CustomPartSpec[] = [];
  for (const r of Array.isArray(parts) ? parts.slice(0, 50) : []) {
    try {
      const spec = validateSpec(r, { keepType: true });
      if (registerSpec(spec)) out.push(spec);
    } catch {
      /* invalid part definition: ignored */
    }
  }
  return out;
}
