import type { SavedProject } from '../model/persistence';
import type { CircuitDoc } from '../model/types';

/** A project as stored in the account (Firestore users/{uid}/projects/{id}). */
export interface CloudProject {
  id: string;
  name: string;
  savedAt: number;
  /** the circuit as JSON text */
  json: string;
}

export interface SyncPlan {
  /** newer in the account (or new from another device): copy into this browser */
  toLocal: SavedProject[];
  /** linked to the account but deleted there (on another device): remove here */
  deleteLocal: string[];
  /** changed here since the account's copy (edited offline): upload */
  toUpload: SavedProject[];
  /** saved in this browser only, never uploaded */
  localOnly: SavedProject[];
}

/**
 * Decide how this browser's saved projects and the account's projects converge. Projects are
 * matched by their cloud id, or by name for ones saved before signing in; the newer copy wins.
 */
export function planSync(local: SavedProject[], cloud: CloudProject[], parse: (json: string) => CircuitDoc): SyncPlan {
  const plan: SyncPlan = { toLocal: [], deleteLocal: [], toUpload: [], localOnly: [] };
  const byName = new Map(local.map((p) => [p.name, p]));
  const cloudIds = new Set(cloud.map((c) => c.id));
  const cloudNames = new Set(cloud.map((c) => c.name));
  for (const c of cloud) {
    const l = byName.get(c.name);
    if (!l || l.savedAt < c.savedAt) {
      try {
        plan.toLocal.push({ name: c.name, savedAt: c.savedAt, doc: { ...parse(c.json), name: c.name }, cloudId: c.id });
      } catch {
        /* a damaged cloud copy is skipped rather than breaking the sync */
      }
    } else if (l.savedAt > c.savedAt) plan.toUpload.push({ ...l, cloudId: c.id });
    else if (l.cloudId !== c.id) plan.toLocal.push({ ...l, cloudId: c.id });
  }
  for (const l of local) {
    if (cloudNames.has(l.name)) continue;
    if (l.cloudId && !cloudIds.has(l.cloudId)) plan.deleteLocal.push(l.name);
    else if (!l.cloudId) plan.localOnly.push(l);
  }
  return plan;
}
