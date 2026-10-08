/**
 * MakerLab captcha check on Cloudflare Workers (free plan), so Firebase can stay on its free
 * Spark plan (Cloud Functions need Blaze).
 *
 *   POST /   Authorization: Bearer <Firebase ID token>   body: { "token": "<hCaptcha response>" }
 *
 * 1. checks the Firebase ID token (signature with Google's public keys, project, expiry)
 * 2. checks the hCaptcha token with hCaptcha's servers using the secret key
 * 3. marks users/{uid} as verified in Firestore (REST API, as the service account), keeping any
 *    projectIds it already has — the Firestore rules only let verified accounts store projects
 *
 * Secrets (wrangler secret put …): HCAPTCHA_SECRET, FIREBASE_SERVICE_ACCOUNT (the JSON key file)
 * Vars (wrangler.toml): FIREBASE_PROJECT_ID, ALLOWED_ORIGINS, optional HCAPTCHA_SITE_KEY
 */

const GOOGLE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const HCAPTCHA_VERIFY = 'https://api.hcaptcha.com/siteverify';
const OAUTH_TOKEN = 'https://oauth2.googleapis.com/token';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const enc = new TextEncoder();
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlJson = (obj) => b64url(enc.encode(JSON.stringify(obj)));
function unb64url(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ---------------------------------------------------------------- Firebase ID token

let jwksCache = { keys: null, until: 0 };
async function googleKeys() {
  if (jwksCache.keys && Date.now() < jwksCache.until) return jwksCache.keys;
  const res = await fetch(GOOGLE_JWKS);
  if (!res.ok) throw new HttpError(502, 'Could not load Google sign-in keys.');
  const { keys } = await res.json();
  const age = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '');
  jwksCache = { keys, until: Date.now() + (age ? Number(age[1]) : 3600) * 1000 };
  return keys;
}

export async function verifyIdToken(idToken, projectId, now = Math.floor(Date.now() / 1000)) {
  const parts = (idToken || '').split('.');
  if (parts.length !== 3) throw new HttpError(401, 'Sign in first.');
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(unb64url(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(unb64url(parts[1])));
  } catch {
    throw new HttpError(401, 'Sign in first.');
  }
  if (header.alg !== 'RS256') throw new HttpError(401, 'Sign in first.');
  const jwk = (await googleKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new HttpError(401, 'Your sign-in has expired; sign in again.');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64url(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new HttpError(401, 'Sign in first.');
  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) throw new HttpError(401, 'This sign-in belongs to a different app.');
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) throw new HttpError(401, 'Sign in first.');
  if (!(payload.exp > now - 60) || !(payload.iat <= now + 60)) throw new HttpError(401, 'Your sign-in has expired; sign in again.');
  return { uid: payload.sub, email: typeof payload.email === 'string' ? payload.email : null };
}

// ---------------------------------------------------------------- hCaptcha

async function checkCaptcha(token, env) {
  const body = new URLSearchParams({ secret: env.HCAPTCHA_SECRET, response: token });
  if (env.HCAPTCHA_SITE_KEY) body.set('sitekey', env.HCAPTCHA_SITE_KEY);
  const res = await fetch(HCAPTCHA_VERIFY, { method: 'POST', body });
  const out = await res.json().catch(() => ({}));
  if (!out.success) throw new HttpError(403, 'The captcha was not accepted. Please try again.');
}

// ---------------------------------------------------------------- Firestore as the service account

let accessCache = { token: '', until: 0 };
async function accessToken(sa) {
  if (accessCache.token && Date.now() < accessCache.until) return accessCache.token;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64urlJson({ alg: 'RS256', typ: 'JWT' })}.${b64urlJson({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: OAUTH_TOKEN, iat: now, exp: now + 3600,
  })}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(unsigned));
  const res = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
  });
  const out = await res.json().catch(() => ({}));
  if (!out.access_token) throw new HttpError(502, 'The server could not reach the database.');
  accessCache = { token: out.access_token, until: Date.now() + ((out.expires_in || 3600) - 120) * 1000 };
  return accessCache.token;
}

/** One atomic write: set email + verified, stamp verifiedAt, and create projectIds only if missing. */
export async function markVerified(uid, email, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const base = env.FIRESTORE_URL || 'https://firestore.googleapis.com';
  const auth = env.FIRESTORE_URL ? 'owner' : await accessToken(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT));
  const db = `projects/${projectId}/databases/(default)`;
  const res = await fetch(`${base}/v1/${db}/documents:commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      writes: [{
        update: { name: `${db}/documents/users/${uid}`, fields: { email: email ? { stringValue: email } : { nullValue: null }, verified: { booleanValue: true } } },
        updateMask: { fieldPaths: ['email', 'verified'] },
        updateTransforms: [
          { fieldPath: 'verifiedAt', setToServerValue: 'REQUEST_TIME' },
          { fieldPath: 'projectIds', appendMissingElements: { values: [] } },
        ],
      }],
    }),
  });
  if (!res.ok) throw new HttpError(502, `The database refused the update (${res.status}).`);
}

// ---------------------------------------------------------------- HTTP

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = origin && allowed.includes(origin);
  return {
    ok,
    headers: ok ? {
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-max-age': '86400',
      vary: 'origin',
    } : { vary: 'origin' },
  };
}

const json = (status, body, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } });

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request.headers.get('origin'), env);
    if (request.method === 'OPTIONS') return new Response(null, { status: cors.ok ? 204 : 403, headers: cors.headers });
    if (!cors.ok) return json(403, { error: 'This website may not use the captcha check.' }, cors.headers);
    if (request.method !== 'POST') return json(405, { error: 'Use POST.' }, cors.headers);
    try {
      const idToken = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const user = await verifyIdToken(idToken, env.FIREBASE_PROJECT_ID);
      const body = await request.json().catch(() => ({}));
      const token = body && body.token;
      if (typeof token !== 'string' || !token || token.length > 8192) throw new HttpError(400, 'Missing captcha token.');
      await checkCaptcha(token, env);
      await markVerified(user.uid, user.email, env);
      return json(200, { ok: true }, cors.headers);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      return json(status, { error: e instanceof HttpError ? e.message : 'Something went wrong. Please try again.' }, cors.headers);
    }
  },
};

/** for tests */
export function _resetCaches() {
  jwksCache = { keys: null, until: 0 };
  accessCache = { token: '', until: 0 };
}
