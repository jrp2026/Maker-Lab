/**
 * Cloud accounts (Firebase) and hCaptcha are configured at build time through Vite environment
 * variables (see docs/cloud-setup.md). Without them the app works exactly as before: projects are
 * saved in this browser only and no sign-in is offered.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const FIREBASE_CONFIG = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
};
/** region of the verifyCaptcha Cloud Function */
export const FUNCTIONS_REGION = env.VITE_FIREBASE_FUNCTIONS_REGION || 'us-central1';
/** development: talk to the local Firebase emulators (auth 9099, firestore 8085, functions 5001) */
export const USE_EMULATORS = env.VITE_FIREBASE_EMULATORS === '1';
export const HCAPTCHA_SITE_KEY = env.VITE_HCAPTCHA_SITE_KEY ?? '';
/** the Cloudflare Worker that checks the captcha (cloudflare/captcha-worker); without it the verifyCaptcha Cloud Function is used */
export const CAPTCHA_URL = env.VITE_CAPTCHA_URL ?? '';

/** are cloud accounts available in this build? */
export const cloudEnabled = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);

/** used when Firestore has no config/limits document */
export const DEFAULT_PROJECT_LIMIT = 25;
/** Firestore documents are limited to 1 MiB; a circuit's JSON must stay under this */
export const MAX_PROJECT_BYTES = 900_000;
