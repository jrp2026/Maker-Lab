# Cloud saving setup (Firebase + hCaptcha)

MakerLab can save projects to user accounts so they sync between devices. Sign-in is by email and
password or with Google. New accounts must pass an hCaptcha, which a free Cloudflare Worker checks
on the server, so Firebase stays on its free **Spark** plan. The number of projects per account is capped by a value stored in Firestore.

Until the variables below are set, the app works as before: projects are saved only in the
browser, and no sign-in is shown.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Add project** (Analytics is optional).
2. **Build → Authentication → Get started**, then enable these sign-in providers:
   - **Email/Password**
   - **Google** (choose a support email)
3. **Authentication → Settings → Authorized domains**: add `jrp2026.github.io`. `localhost` is
   already listed, for development.
4. **Build → Firestore Database → Create database**. Choose production mode and a location near
   your users.
5. **Project settings → General → Your apps → Web app (`</>`)**: register an app called MakerLab.
   Copy `apiKey`, `authDomain`, `projectId` and `appId` from the config it shows.

## 2. Get the hCaptcha keys

1. Sign up at <https://dashboard.hcaptcha.com>. **Sites → New site**, and add the hostnames
   `jrp2026.github.io` and `localhost`.
2. Note two values:
   - the **site key**, which is public and goes into the app;
   - the **secret key**, from **Settings**, which only the Worker uses. Never put it in the app.

## 3. Deploy the security rules

Firebase stays on the free Spark plan. Only the rules need deploying (Google Cloud Shell at
<https://shell.cloud.google.com> works well for this):

```bash
git clone https://github.com/jrp2026/Maker-Lab.git && cd Maker-Lab
npm install -g firebase-tools
firebase login --no-localhost
firebase use <your projectId>
firebase deploy --only firestore:rules
```

## 3b. Create the captcha Worker (Cloudflare, free)

The Worker in `cloudflare/captcha-worker` checks the captcha with your secret key, checks who is
signing up from their Firebase sign-in, and marks the account verified in Firestore.

1. **A key that lets the Worker write to Firestore.** In Firebase: **Project settings → Service
   accounts → Generate new private key**. This downloads a JSON file. Treat it like a password:
   never commit it, and delete it once step 3 below is done.
2. Sign up at <https://dash.cloudflare.com> (free). Then, in a terminal (Cloud Shell is fine):
   ```bash
   cd Maker-Lab/cloudflare/captcha-worker
   npx wrangler login
   ```
   Edit `wrangler.toml`: set `FIREBASE_PROJECT_ID` to your projectId, and optionally
   `HCAPTCHA_SITE_KEY` to your site key.
3. Add the two secrets and deploy:
   ```bash
   npx wrangler secret put HCAPTCHA_SECRET            # paste the hCaptcha secret key
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT < path/to/the-key.json
   npx wrangler deploy
   ```
   The deploy prints the Worker's address, for example
   `https://makerlab-captcha.<you>.workers.dev`. That's `VITE_CAPTCHA_URL` in step 5.

The free Workers plan allows 100,000 requests a day; each sign-up uses one.

(The older Cloud Function in `firebase/functions` still works if you'd rather use the Blaze plan.
Leave `VITE_CAPTCHA_URL` empty and run `firebase deploy --only firestore:rules,functions`.)

## 4. Set the project limit

In **Firestore → Start collection**:

- collection `config`, document id `limits`
- field `maxProjects` of type number, for example `25`

This limit applies to every account. To give one person a different limit, add a number field
`maxProjects` to their document `users/{uid}`. The rules read that value first.

If `config/limits` doesn't exist, the limit is 25. The security rules enforce the limit, so a
modified app can't get around it.

## 5. Give the build its configuration

In the GitHub repository, go to **Settings → Secrets and variables → Actions → Variables** and add
these **repository variables**. None of them are secret: web apps always ship them to the browser. GitHub may flag the
Firebase `apiKey` as a "leaked Google API key". For Firebase web apps that key is public by design;
lock it down as described below instead of hiding it.

| Variable | Value |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` (e.g. `makerlab-xxxx.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_HCAPTCHA_SITE_KEY` | the hCaptcha **site** key |
| `VITE_CAPTCHA_URL` | the Worker address from step 3b |

Then re-run **Actions → Deploy to GitHub Pages**, or push any commit. For local development, put
the same values in a `.env.local` file at the repository root; it is ignored by git.

## How it works

- **Firestore layout**
  - `users/{uid}` holds `{ email, verified, projectIds[], maxProjects? }`.
  - `users/{uid}/projects/{id}` holds `{ name, savedAt, json }`, where `json` is the circuit.
- **Verification.** Only the captcha Worker (or the `verifyCaptcha` function) can create `users/{uid}` or set
  `verified: true`, and it does so only after hCaptcha accepts the token. Until then the rules
  refuse all project writes. Accounts created with Google solve the same captcha on their first
  sign-in.
- **The limit.** Adding a project must add its id to `projectIds` in the same write, and the
  rules refuse the write when `projectIds` would exceed the limit. Deleting removes both
  together.
- **Syncing.**
  - Every browser keeps its own copy of each project, so projects still work offline.
  - When signed in, saving (Ctrl+S) writes both copies.
  - Changes made on other devices arrive live; the newer copy wins.
  - Projects saved before signing in can be uploaded from the projects page.
  - Signing out keeps this browser's copies.
- **Size.** A project must be under about 900 kB of JSON, since Firestore documents are limited
  to 1 MiB.

## Lock down the API key

Google Cloud console → **APIs & Services → Credentials** → the key named "Browser key (auto created
by Firebase)":

- **Application restrictions → Websites:** `https://jrp2026.github.io/*`, `http://localhost:*/*`
- **API restrictions → Restrict key:** Identity Toolkit API, Token Service API, Cloud Firestore API

Then the key only works from your site and only for sign-in and the database, where the security
rules still decide what each user may do.

## Testing the rules

`npm run test:rules` runs `firebase/rules.test.mjs` against the Firestore emulator. It needs
`firebase-tools` and Java.

`tests/captcha-worker.test.ts` tests the Worker: forged, expired and foreign sign-ins, failed captchas
and other websites are all refused.
