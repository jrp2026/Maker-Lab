/**
 * Firestore security rules tests. Run with the emulator:
 *   npm run test:rules      (needs firebase-tools and Java; see docs/cloud-setup.md)
 */
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, getDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove, collection } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'makerlab-rules-test',
    firestore: { rules: readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8') },
  });
});
after(async () => env.cleanup());
beforeEach(async () => env.clearFirestore());

/** what the verifyCaptcha function does, plus optional limits */
async function seed({ verified = true, ids = [], userLimit, globalLimit } = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), { email: 'a@x.io', verified, projectIds: ids, ...(userLimit ? { maxProjects: userLimit } : {}) });
    for (const id of ids) await setDoc(doc(db, `users/alice/projects/${id}`), { name: id, savedAt: 1, json: '{}' });
    if (globalLimit) await setDoc(doc(db, 'config/limits'), { maxProjects: globalLimit });
  });
}
const alice = () => env.authenticatedContext('alice').firestore();
const data = (name = 'p', json = '{}') => ({ name, savedAt: Date.now(), json });

/** create a project the way the app does: project + projectIds in one batch */
function createProject(db, id, d = data(id)) {
  const b = writeBatch(db);
  b.set(doc(db, `users/alice/projects/${id}`), d);
  b.update(doc(db, 'users/alice'), { projectIds: arrayUnion(id) });
  return b.commit();
}
function deleteProject(db, id) {
  const b = writeBatch(db);
  b.delete(doc(db, `users/alice/projects/${id}`));
  b.update(doc(db, 'users/alice'), { projectIds: arrayRemove(id) });
  return b.commit();
}

test('a verified account can create, update and delete projects', async () => {
  await seed();
  const db = alice();
  await assertSucceeds(createProject(db, 'p1'));
  await assertSucceeds(setDoc(doc(db, 'users/alice/projects/p1'), data('renamed')));
  await assertSucceeds(getDoc(doc(db, 'users/alice/projects/p1')));
  await assertSucceeds(deleteProject(db, 'p1'));
});

test('without the server-side captcha check nothing can be stored', async () => {
  const db = alice();
  // no user document yet (the function creates it)
  await assertFails(createProject(db, 'p1'));
  await assertFails(setDoc(doc(db, 'users/alice'), { email: 'a@x.io', verified: true, projectIds: [] }));
  await seed({ verified: false });
  await assertFails(createProject(db, 'p1'));
  await assertFails(updateDoc(doc(db, 'users/alice'), { verified: true }));
});

test('the account cannot change its own verified flag or limit', async () => {
  await seed();
  const db = alice();
  await assertFails(updateDoc(doc(db, 'users/alice'), { maxProjects: 1000 }));
  await assertFails(updateDoc(doc(db, 'users/alice'), { verified: false }));
});

test('the global limit in config/limits caps the number of projects', async () => {
  await seed({ globalLimit: 2 });
  const db = alice();
  await assertSucceeds(createProject(db, 'a'));
  await assertSucceeds(createProject(db, 'b'));
  await assertFails(createProject(db, 'c'));
  await assertSucceeds(deleteProject(db, 'a'));
  await assertSucceeds(createProject(db, 'c'));
});

test('a per-user limit overrides the global one', async () => {
  await seed({ globalLimit: 1, userLimit: 3 });
  const db = alice();
  await assertSucceeds(createProject(db, 'a'));
  await assertSucceeds(createProject(db, 'b'));
  await assertSucceeds(createProject(db, 'c'));
  await assertFails(createProject(db, 'd'));
});

test('the project list and the projects must change together', async () => {
  await seed({ ids: ['x'] });
  const db = alice();
  // a project not added to projectIds (would dodge the limit)
  await assertFails(setDoc(doc(db, 'users/alice/projects/sneaky'), data()));
  // an id added without its project, or removed while the project stays
  await assertFails(updateDoc(doc(db, 'users/alice'), { projectIds: arrayUnion('ghost') }));
  await assertFails(updateDoc(doc(db, 'users/alice'), { projectIds: arrayRemove('x') }));
  // a project deleted but still counted
  await assertFails(deleteDoc(doc(db, 'users/alice/projects/x')));
  // two at once
  const b = writeBatch(db);
  b.set(doc(db, 'users/alice/projects/m'), data());
  b.set(doc(db, 'users/alice/projects/n'), data());
  b.update(doc(db, 'users/alice'), { projectIds: arrayUnion('m', 'n') });
  await assertFails(b.commit());
});

test('projects must be well-formed and under the size limit', async () => {
  await seed();
  const db = alice();
  await assertFails(createProject(db, 'big', data('big', 'x'.repeat(950_000))));
  await assertFails(createProject(db, 'extra', { ...data('extra'), owner: 'bob' }));
  await assertFails(createProject(db, 'noname', { name: '', savedAt: 1, json: '{}' }));
});

test('nobody else can read or write an account', async () => {
  await seed({ ids: ['x'] });
  const bob = env.authenticatedContext('bob').firestore();
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(bob, 'users/alice')));
  await assertFails(getDoc(doc(bob, 'users/alice/projects/x')));
  await assertFails(setDoc(doc(bob, 'users/alice/projects/x'), data()));
  await assertFails(getDoc(doc(anon, 'users/alice/projects/x')));
  void collection;
});

test('config is readable by signed-in users only, and never writable', async () => {
  await seed({ globalLimit: 5 });
  await assertSucceeds(getDoc(doc(alice(), 'config/limits')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'config/limits')));
  await assertFails(setDoc(doc(alice(), 'config/limits'), { maxProjects: 999 }));
});
