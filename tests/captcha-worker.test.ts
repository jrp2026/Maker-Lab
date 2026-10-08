import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain JS worker
import worker, { _resetCaches } from '../cloudflare/captcha-worker/src/index.js';

const PROJECT = 'makerlab-test';
const ORIGIN = 'https://jrp2026.github.io';
const env = { FIREBASE_PROJECT_ID: PROJECT, ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`, HCAPTCHA_SECRET: 'shh', HCAPTCHA_SITE_KEY: '', FIREBASE_SERVICE_ACCOUNT: '' };

const enc = new TextEncoder();
const b64url = (b: ArrayBuffer | Uint8Array) => Buffer.from(b as Uint8Array).toString('base64url');
const alg = { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } as const;
let google: CryptoKeyPair, other: CryptoKeyPair, saKey: CryptoKeyPair, jwk: JsonWebKey;

async function idToken(claims: Record<string, unknown> = {}, keys = google, kid = 'k1') {
  const now = Math.floor(Date.now() / 1000);
  const h = b64url(enc.encode(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })));
  const p = b64url(enc.encode(JSON.stringify({ aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`, sub: 'user-1', email: 'a@b.c', iat: now - 10, exp: now + 3600, ...claims })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64url(sig)}`;
}

let captchaOk = true;
let commits: any[] = [];
let tokenCalls = 0;

beforeAll(async () => {
  google = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair;
  other = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair;
  saKey = (await crypto.subtle.generateKey(alg, true, ['sign', 'verify'])) as CryptoKeyPair;
  jwk = { ...(await crypto.subtle.exportKey('jwk', google.publicKey)), kid: 'k1' } as JsonWebKey;
  const pkcs8 = Buffer.from(await crypto.subtle.exportKey('pkcs8', saKey.privateKey)).toString('base64');
  env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ client_email: 'sa@x.iam.gserviceaccount.com', private_key: `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g)!.join('\n')}\n-----END PRIVATE KEY-----\n` });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.includes('securetoken@system')) return new Response(JSON.stringify({ keys: [jwk] }), { headers: { 'cache-control': 'max-age=600' } });
    if (url.includes('hcaptcha.com')) {
      expect(String(init!.body)).toContain('secret=shh');
      return new Response(JSON.stringify({ success: captchaOk }));
    }
    if (url.includes('oauth2.googleapis.com')) {
      tokenCalls++;
      // the assertion must be signed by the service account key
      const jwt = new URLSearchParams(String(init!.body)).get('assertion')!.split('.');
      const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', saKey.publicKey, Buffer.from(jwt[2], 'base64url'), enc.encode(`${jwt[0]}.${jwt[1]}`));
      return new Response(JSON.stringify(ok ? { access_token: 'ya29.test', expires_in: 3600 } : { error: 'bad' }));
    }
    if (url.includes('documents:commit')) {
      expect((init!.headers as Record<string, string>).authorization).toBe('Bearer ya29.test');
      commits.push({ url, body: JSON.parse(String(init!.body)) });
      return new Response('{}');
    }
    throw new Error(`unexpected fetch ${url}`);
  });
});

afterEach(() => {
  captchaOk = true;
  commits = [];
  _resetCaches();
});

const call = async (headers: Record<string, string>, body: unknown = { token: 'captcha-ok' }, method = 'POST') =>
  worker.fetch(new Request('https://w.example/', { method, headers: { origin: ORIGIN, 'content-type': 'application/json', ...headers }, body: method === 'POST' ? JSON.stringify(body) : undefined }), env);

describe('captcha worker (Cloudflare)', () => {
  it('verifies the captcha and marks the signed-in user as verified', async () => {
    const res = await call({ authorization: `Bearer ${await idToken()}` });
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(commits).toHaveLength(1);
    const w = commits[0].body.writes[0];
    expect(commits[0].url).toContain(`/projects/${PROJECT}/databases/(default)/documents:commit`);
    expect(w.update.name).toBe(`projects/${PROJECT}/databases/(default)/documents/users/user-1`);
    expect(w.update.fields).toEqual({ email: { stringValue: 'a@b.c' }, verified: { booleanValue: true } });
    expect(w.updateMask.fieldPaths).toEqual(['email', 'verified']);
    expect(w.updateTransforms.map((t: any) => t.fieldPath)).toEqual(['verifiedAt', 'projectIds']);
  });

  it('rejects a failed captcha without touching the database', async () => {
    captchaOk = false;
    const res = await call({ authorization: `Bearer ${await idToken()}` });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/captcha/);
    expect(commits).toHaveLength(0);
  });

  it('rejects missing, forged, expired or foreign sign-ins', async () => {
    expect((await call({})).status).toBe(401);
    expect((await call({ authorization: `Bearer ${await idToken({}, other)}` })).status).toBe(401);
    expect((await call({ authorization: `Bearer ${await idToken({ exp: 1000 })}` })).status).toBe(401);
    expect((await call({ authorization: `Bearer ${await idToken({ aud: 'someone-else' })}` })).status).toBe(401);
    expect((await call({ authorization: `Bearer ${await idToken({}, google, 'unknown')}` })).status).toBe(401);
    expect(commits).toHaveLength(0);
  });

  it('only answers the MakerLab website', async () => {
    const res = await worker.fetch(new Request('https://w.example/', { method: 'POST', headers: { origin: 'https://evil.example' }, body: '{}' }), env);
    expect(res.status).toBe(403);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await call({}, undefined, 'OPTIONS');
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('needs a captcha token and reuses the database access token', async () => {
    const t = await idToken();
    expect((await call({ authorization: `Bearer ${t}` }, {})).status).toBe(400);
    tokenCalls = 0;
    await call({ authorization: `Bearer ${t}` });
    await call({ authorization: `Bearer ${t}` });
    expect(tokenCalls).toBe(1);
  });
});
