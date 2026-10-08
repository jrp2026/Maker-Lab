/**
 * Accounts and cloud saving (Firebase Auth + Firestore). Projects keep being saved in this browser;
 * with an account they are also stored in Firestore and kept in sync on every device signed in.
 *
 * Firestore layout (rules: firebase/firestore.rules):
 *   config/limits                { maxProjects }                     read-only for users
 *   users/{uid}                  { email, verified, projectIds[], maxProjects? }
 *                                  created / verified by the verifyCaptcha Cloud Function
 *   users/{uid}/projects/{id}    { name, savedAt, json }
 * The rules only let an account write projects after its hCaptcha was verified server-side, and
 * keep projectIds (and so the number of projects) within the limit.
 */
import { create } from 'zustand';
import { cloudEnabled, DEFAULT_PROJECT_LIMIT, FIREBASE_CONFIG, FUNCTIONS_REGION, MAX_PROJECT_BYTES, USE_EMULATORS, CAPTCHA_URL } from './config';
import { planSync, type CloudProject } from './sync';
import { deleteProject, duplicateProject, listProjects, onProjectsChanged, parseDoc, putLocalProject, renameProject, saveProject, type SavedProject } from '../model/persistence';
import type { CircuitDoc } from '../model/types';
import { showToast } from '../model/store';

export interface AccountUser {
  uid: string;
  email: string | null;
  name: string | null;
  photo: string | null;
}

interface AccountState {
  /** off: no Firebase config in this build */
  status: 'off' | 'idle' | 'loading' | 'signed-out' | 'signed-in';
  user: AccountUser | null;
  /** hCaptcha checked by the server: the account may store projects */
  verified: boolean;
  /** how many projects the account may store (from Firestore) */
  limit: number;
  cloud: CloudProject[];
  /** projects in this browser that aren't in the account yet */
  localOnly: SavedProject[];
  syncing: boolean;
  dialog: 'signin' | 'signup' | 'captcha' | null;
}

export const useAccount = create<AccountState>(() => ({
  status: cloudEnabled ? 'idle' : 'off',
  user: null,
  verified: false,
  limit: DEFAULT_PROJECT_LIMIT,
  cloud: [],
  localOnly: [],
  syncing: false,
  dialog: null,
}));

const SIGNED_IN_KEY = 'makerlab.cloud';
const remember = (on: boolean) => {
  try {
    if (on) localStorage.setItem(SIGNED_IN_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    /* ignore */
  }
};

// ------------------------------------------------------------------ Firebase, loaded on demand

type Sdk = Awaited<ReturnType<typeof loadSdk>>;
let sdkPromise: Promise<Sdk> | null = null;

async function loadSdk() {
  const [appM, authM, fsM, fnM] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore'), import('firebase/functions')]);
  const app = appM.initializeApp(FIREBASE_CONFIG);
  const out = { authM, fsM, fnM, auth: authM.getAuth(app), db: fsM.getFirestore(app), fns: fnM.getFunctions(app, FUNCTIONS_REGION) };
  if (USE_EMULATORS) {
    authM.connectAuthEmulator(out.auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fsM.connectFirestoreEmulator(out.db, '127.0.0.1', 8085);
    fnM.connectFunctionsEmulator(out.fns, '127.0.0.1', 5001);
  }
  return out;
}

function sdk(): Promise<Sdk> {
  if (!cloudEnabled) return Promise.reject(new Error('Cloud accounts are not configured in this build.'));
  if (!sdkPromise) {
    sdkPromise = loadSdk();
    sdkPromise.then(watchAuth, () => (sdkPromise = null));
  }
  return sdkPromise;
}

/** At startup: reconnect if this browser was signed in before (otherwise nothing is loaded). */
export function initAccount() {
  if (!cloudEnabled) return;
  let was = false;
  try {
    was = localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    was = false;
  }
  if (was) {
    useAccount.setState({ status: 'loading' });
    sdk().catch(() => useAccount.setState({ status: 'signed-out' }));
  }
}

export const openAccountDialog = (dialog: 'signin' | 'signup' = 'signin') => {
  useAccount.setState({ dialog });
  sdk().catch(() => undefined);
};
export const closeAccountDialog = () => useAccount.setState({ dialog: null });

// ------------------------------------------------------------------ listeners

let unsubs: (() => void)[] = [];
const stopListening = () => {
  for (const u of unsubs) u();
  unsubs = [];
};
let globalLimit = DEFAULT_PROJECT_LIMIT;
let userLimit: number | undefined;
let projectIds: string[] = [];

function watchAuth(s: Sdk) {
  s.authM.onAuthStateChanged(s.auth, (u) => {
    stopListening();
    if (!u) {
      remember(false);
      useAccount.setState({ status: 'signed-out', user: null, verified: false, cloud: [], localOnly: [] });
      return;
    }
    remember(true);
    useAccount.setState({ status: 'signed-in', user: { uid: u.uid, email: u.email, name: u.displayName, photo: u.photoURL } });
    const { doc, collection, onSnapshot } = s.fsM;
    unsubs.push(
      onSnapshot(doc(s.db, 'config', 'limits'), (snap) => {
        globalLimit = Number(snap.get('maxProjects')) || DEFAULT_PROJECT_LIMIT;
        useAccount.setState({ limit: userLimit ?? globalLimit });
      }, () => undefined),
      onSnapshot(doc(s.db, 'users', u.uid), (snap) => {
        const verified = snap.exists() && snap.get('verified') === true;
        projectIds = (snap.get('projectIds') as string[] | undefined) ?? [];
        userLimit = Number(snap.get('maxProjects')) || undefined;
        useAccount.setState({ verified, limit: userLimit ?? globalLimit });
        // new account (e.g. first Google sign-in): the captcha still has to be solved
        if (!verified && useAccount.getState().dialog !== 'signup') useAccount.setState({ dialog: 'captcha' });
      }, () => undefined),
      onSnapshot(collection(s.db, 'users', u.uid, 'projects'), (snap) => {
        const cloud: CloudProject[] = snap.docs.map((d) => ({ id: d.id, name: String(d.get('name')), savedAt: Number(d.get('savedAt')) || 0, json: String(d.get('json') ?? '') }));
        useAccount.setState({ cloud });
        void runSync();
      }, () => undefined),
      // local saves (including ones the account refused) change what is "only in this browser"
      onProjectsChanged(() => queueMicrotask(() => void runSync())),
    );
  });
}

// ------------------------------------------------------------------ sign in / up / out

/** readable text for Firebase errors */
export function accountError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/email-already-in-use': 'There is already an account with this email — sign in instead.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account with this email — create one.',
    'auth/invalid-email': 'That email address doesn\'t look right.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts — wait a minute and try again.',
    'auth/popup-closed-by-user': 'The Google window was closed before signing in.',
    'auth/popup-blocked': 'The browser blocked the Google window — allow pop-ups for this site.',
    'auth/network-request-failed': 'No connection to the server — check your internet.',
    'auth/unauthorized-domain': 'This website isn\'t allowed to sign in yet (add it to Firebase → Authentication → Authorized domains).',
    'functions/permission-denied': 'The captcha was not accepted — please try again.',
    'permission-denied': 'The account refused this change (project limit reached, or the captcha isn\'t done).',
  };
  return map[code] ?? (e as Error)?.message ?? String(e);
}

async function verifyCaptcha(s: Sdk, token: string) {
  if (!CAPTCHA_URL) {
    await s.fnM.httpsCallable(s.fns, 'verifyCaptcha')({ token });
    return;
  }
  const user = s.auth.currentUser;
  if (!user) throw new Error('Sign in first.');
  let res: Response;
  try {
    res = await fetch(CAPTCHA_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${await user.getIdToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    throw Object.assign(new Error('No connection to the captcha check. Check your internet and try again.'), { code: 'captcha/network' });
  }
  if (res.ok) return;
  const out = (await res.json().catch(() => ({}))) as { error?: string };
  throw Object.assign(new Error(out.error ?? `The captcha check failed (${res.status}).`), { code: `captcha/${res.status}` });
}

export async function signUpEmail(email: string, password: string, captchaToken: string) {
  const s = await sdk();
  const cred = await s.authM.createUserWithEmailAndPassword(s.auth, email, password);
  await verifyCaptcha(s, captchaToken);
  s.authM.sendEmailVerification(cred.user).catch(() => undefined);
}

export async function signInEmail(email: string, password: string) {
  const s = await sdk();
  await s.authM.signInWithEmailAndPassword(s.auth, email, password);
}

/** Google sign-in; when creating an account, the already solved captcha token verifies it. */
export async function signInGoogle(captchaToken?: string) {
  const s = await sdk();
  await s.authM.signInWithPopup(s.auth, new s.authM.GoogleAuthProvider());
  if (captchaToken) await verifyCaptcha(s, captchaToken);
}

/** Solve the captcha for an account created with Google (or before the captcha was done). */
export async function completeCaptcha(token: string) {
  const s = await sdk();
  await verifyCaptcha(s, token);
}

export async function resetPassword(email: string) {
  const s = await sdk();
  await s.authM.sendPasswordResetEmail(s.auth, email);
}

export async function signOutAccount() {
  const s = await sdk();
  // unlink this browser's copies, so another account signing in here never deletes them
  for (const p of listProjects()) if (p.cloudId) putLocalProject({ name: p.name, savedAt: p.savedAt, doc: p.doc });
  await s.authM.signOut(s.auth);
}

// ------------------------------------------------------------------ cloud projects

const signedIn = () => useAccount.getState().status === 'signed-in' && useAccount.getState().verified;

class LimitError extends Error {}

/** Upload one project (create or update its cloud copy). */
async function upload(p: SavedProject): Promise<string> {
  const s = await sdk();
  const uid = useAccount.getState().user!.uid;
  const json = JSON.stringify(p.doc);
  if (json.length > MAX_PROJECT_BYTES) throw new Error(`“${p.name}” is too big to store in the account (${Math.round(json.length / 1000)} kB, the limit is ${MAX_PROJECT_BYTES / 1000} kB).`);
  const { doc, collection, writeBatch, arrayUnion } = s.fsM;
  const data = { name: p.name, savedAt: p.savedAt, json };
  const existing = useAccount.getState().cloud.find((c) => c.id === p.cloudId) ?? useAccount.getState().cloud.find((c) => c.name === p.name);
  if (existing) {
    await s.fsM.setDoc(doc(s.db, 'users', uid, 'projects', existing.id), data);
    return existing.id;
  }
  if (projectIds.length >= useAccount.getState().limit) throw new LimitError(`Your account holds at most ${useAccount.getState().limit} projects — delete one to make room.`);
  const ref = doc(collection(s.db, 'users', uid, 'projects'));
  const batch = writeBatch(s.db);
  batch.set(ref, data);
  batch.update(doc(s.db, 'users', uid), { projectIds: arrayUnion(ref.id) });
  await batch.commit();
  return ref.id;
}

async function removeCloud(id: string) {
  const s = await sdk();
  const uid = useAccount.getState().user!.uid;
  const { doc, writeBatch, arrayRemove } = s.fsM;
  const batch = writeBatch(s.db);
  batch.delete(doc(s.db, 'users', uid, 'projects', id));
  batch.update(doc(s.db, 'users', uid), { projectIds: arrayRemove(id) });
  await batch.commit();
}

let syncing = false, again = false;
/** Bring this browser and the account together (newer copy wins). */
async function runSync() {
  if (!signedIn()) {
    useAccount.setState({ localOnly: [] });
    return;
  }
  if (syncing) {
    again = true;
    return;
  }
  syncing = true;
  useAccount.setState({ syncing: true });
  try {
    const plan = planSync(listProjects(), useAccount.getState().cloud, (j) => parseDoc(JSON.parse(j)));
    for (const p of plan.toLocal) putLocalProject(p);
    for (const name of plan.deleteLocal) deleteProject(name);
    for (const p of plan.toUpload) {
      try {
        putLocalProject({ ...p, cloudId: await upload(p) });
      } catch {
        /* kept locally; retried on the next sync */
      }
    }
    useAccount.setState({ localOnly: plan.localOnly });
  } finally {
    syncing = false;
    useAccount.setState({ syncing: false });
    if (again) {
      again = false;
      void runSync();
    }
  }
}

// ------------------------------------------------------------------ what the UI calls

/** Save in this browser and, when signed in, to the account. Resolves to an error message or null. */
export async function saveEverywhere(doc: CircuitDoc): Promise<string | null> {
  saveProject(doc);
  if (!signedIn()) return null;
  const p = listProjects().find((x) => x.name === doc.name)!;
  try {
    putLocalProject({ ...p, cloudId: await upload(p) });
    return null;
  } catch (e) {
    return e instanceof LimitError ? e.message : `Saved in this browser, but not in your account: ${accountError(e)}`;
  }
}

/** Upload projects that are only in this browser (up to the account's limit). */
export async function uploadLocal(names: string[]): Promise<string | null> {
  for (const name of names) {
    const p = listProjects().find((x) => x.name === name);
    if (!p) continue;
    try {
      putLocalProject({ ...p, cloudId: await upload(p) });
    } catch (e) {
      return e instanceof LimitError ? e.message : accountError(e);
    }
  }
  void runSync();
  return null;
}

export async function deleteEverywhere(name: string): Promise<string | null> {
  const p = listProjects().find((x) => x.name === name);
  const cloudId = p?.cloudId ?? useAccount.getState().cloud.find((c) => c.name === name)?.id;
  deleteProject(name);
  if (!cloudId || !signedIn()) return null;
  try {
    await removeCloud(cloudId);
    return null;
  } catch (e) {
    return accountError(e);
  }
}

export async function renameEverywhere(from: string, to: string): Promise<string | null> {
  if (!renameProject(from, to)) return `There is already a project called “${to}”`;
  const p = listProjects().find((x) => x.name === to);
  if (!p?.cloudId || !signedIn()) return null;
  try {
    const now = { ...p, savedAt: Date.now() };
    putLocalProject({ ...now, cloudId: await upload(now) });
    return null;
  } catch (e) {
    return accountError(e);
  }
}

export async function duplicateEverywhere(name: string): Promise<{ copy: string | null; error: string | null }> {
  const copy = duplicateProject(name);
  if (!copy || !signedIn()) return { copy, error: null };
  const p = listProjects().find((x) => x.name === copy)!;
  try {
    putLocalProject({ ...p, cloudId: await upload(p) });
    return { copy, error: null };
  } catch (e) {
    return { copy, error: e instanceof LimitError ? e.message : accountError(e) };
  }
}

/** Save (Ctrl+S / File → Save / projects page) and tell the user where it went. */
export async function saveAndReport(doc: CircuitDoc) {
  const toCloud = signedIn();
  if (toCloud) showToast(`Saving “${doc.name}”…`);
  const err = await saveEverywhere(doc);
  if (err) showToast(err, 'error');
  else showToast(toCloud ? `Saved “${doc.name}” to your account` : `Saved “${doc.name}” in this browser`);
}
