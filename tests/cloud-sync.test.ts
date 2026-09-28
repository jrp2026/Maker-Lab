import { describe, expect, it } from 'vitest';
import { planSync, type CloudProject } from '../src/cloud/sync';
import type { SavedProject } from '../src/model/persistence';
import type { CircuitDoc } from '../src/model/types';

const doc = (name: string, parts = 0): CircuitDoc => ({ version: 1, name, components: Array.from({ length: parts }, (_, i) => ({ id: `c${i}`, type: 'led', x: 0, y: 0, rot: 0, flip: false, props: {} })), wires: [] });
const local = (name: string, savedAt: number, cloudId?: string, parts = 0): SavedProject => ({ name, savedAt, doc: doc(name, parts), ...(cloudId ? { cloudId } : {}) });
const cloud = (id: string, name: string, savedAt: number, parts = 0): CloudProject => ({ id, name, savedAt, json: JSON.stringify(doc(name, parts)) });
const parse = (j: string) => JSON.parse(j) as CircuitDoc;

describe('cloud sync plan', () => {
  it('downloads projects from other devices and newer cloud copies', () => {
    const p = planSync([local('A', 100, 'a')], [cloud('a', 'A', 200, 3), cloud('b', 'B', 50)], parse);
    expect(p.toLocal.map((x) => [x.name, x.savedAt, x.cloudId, x.doc.components.length])).toEqual([['A', 200, 'a', 3], ['B', 50, 'b', 0]]);
    expect(p.toUpload).toEqual([]);
  });

  it('uploads projects edited here since the cloud copy (offline edits)', () => {
    const p = planSync([local('A', 300, 'a')], [cloud('a', 'A', 200)], parse);
    expect(p.toUpload.map((x) => [x.name, x.cloudId])).toEqual([['A', 'a']]);
    expect(p.toLocal).toEqual([]);
  });

  it('links same-name projects saved before signing in', () => {
    const p = planSync([local('A', 100)], [cloud('a', 'A', 100)], parse);
    expect(p.toLocal.map((x) => x.cloudId)).toEqual(['a']);
    expect(p.localOnly).toEqual([]);
  });

  it('removes copies deleted on another device, keeps never-uploaded ones', () => {
    const p = planSync([local('Gone', 100, 'g'), local('Mine', 100)], [], parse);
    expect(p.deleteLocal).toEqual(['Gone']);
    expect(p.localOnly.map((x) => x.name)).toEqual(['Mine']);
  });

  it('does nothing when everything is in step', () => {
    const p = planSync([local('A', 100, 'a')], [cloud('a', 'A', 100)], parse);
    expect(p).toEqual({ toLocal: [], deleteLocal: [], toUpload: [], localOnly: [] });
  });

  it('skips a damaged cloud copy instead of failing', () => {
    const p = planSync([], [{ id: 'x', name: 'X', savedAt: 1, json: '{not json' }], parse);
    expect(p.toLocal).toEqual([]);
  });
});
