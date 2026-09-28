/**
 * verifyCaptcha: called by the app right after an account is created (email sign-up or first
 * Google sign-in) with the hCaptcha response token. The token is checked with hCaptcha's servers
 * using the secret key; only then is users/{uid} created with verified: true, which the Firestore
 * rules require before the account may store projects. The client can't set `verified` itself.
 *
 * Secret:  firebase functions:secrets:set HCAPTCHA_SECRET
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

admin.initializeApp();
const HCAPTCHA_SECRET = defineSecret('HCAPTCHA_SECRET');
/** optional: the site key the token must come from (HCAPTCHA_SITE_KEY in firebase/functions/.env) */
const HCAPTCHA_SITE_KEY = process.env.HCAPTCHA_SITE_KEY || '';

exports.verifyCaptcha = onCall({ secrets: [HCAPTCHA_SECRET], cors: true, maxInstances: 10 }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  const token = req.data && req.data.token;
  if (typeof token !== 'string' || !token || token.length > 8192) throw new HttpsError('invalid-argument', 'Missing captcha token.');

  const body = new URLSearchParams({ secret: HCAPTCHA_SECRET.value(), response: token });
  if (HCAPTCHA_SITE_KEY) body.set('sitekey', HCAPTCHA_SITE_KEY);
  const res = await fetch('https://api.hcaptcha.com/siteverify', { method: 'POST', body });
  const out = await res.json().catch(() => ({}));
  if (!out.success) throw new HttpsError('permission-denied', 'The captcha was not accepted — please try again.');

  const db = getFirestore();
  const ref = db.doc(`users/${req.auth.uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    tx.set(ref, {
      email: req.auth.token.email || null,
      verified: true,
      projectIds: snap.exists ? snap.get('projectIds') || [] : [],
      verifiedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  return { ok: true };
});
