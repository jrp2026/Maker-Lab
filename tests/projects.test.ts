import { beforeEach, describe, expect, it } from 'vitest';
import { deleteProject, duplicateProject, listProjects, renameProject, saveProject, uniqueProjectName } from '../src/model/persistence';
import type { CircuitDoc } from '../src/model/types';

// a minimal in-memory localStorage for the node test environment
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const doc = (name: string): CircuitDoc => ({ version: 1, name, components: [], wires: [] });

describe('your projects (saved in the browser)', () => {
  beforeEach(() => store.clear());

  it('lists saved projects, newest first', async () => {
    saveProject(doc('A'));
    await new Promise((r) => setTimeout(r, 5));
    saveProject(doc('B'));
    expect(listProjects().map((p) => p.name)).toEqual(['B', 'A']);
  });

  it('renames a project (and its circuit), refusing a name that is taken', () => {
    saveProject(doc('A'));
    saveProject(doc('B'));
    expect(renameProject('A', 'B')).toBe(false);
    expect(renameProject('A', 'Robot')).toBe(true);
    const p = listProjects().find((x) => x.name === 'Robot')!;
    expect(p.doc.name).toBe('Robot');
    expect(listProjects().some((x) => x.name === 'A')).toBe(false);
  });

  it('duplicates under a free name and deletes', () => {
    saveProject(doc('Car'));
    expect(duplicateProject('Car')).toBe('Car (copy)');
    expect(duplicateProject('Car')).toBe('Car (copy) (2)');
    expect(uniqueProjectName('Car')).toBe('Car (2)');
    deleteProject('Car');
    expect(listProjects().map((p) => p.name).sort()).toEqual(['Car (copy)', 'Car (copy) (2)']);
  });
});
