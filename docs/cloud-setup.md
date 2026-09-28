# Cloud saving setup (Firebase + hCaptcha)

MakerLab can save projects to user accounts so they sync between devices. Sign-in is by email and
password or with Google. New accounts must pass an hCaptcha, which a Cloud Function checks on the
server. The number of projects per account is capped by a value stored in Firestore.

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
   - the **secret key**, from **Settings**, which only the Cloud Function uses.

## 3. Deploy the rules and the Cloud Function

The captcha check runs in a Cloud Function, which needs the **Blaze** (pay-as-you-go) plan. Its
free tier covers millions of calls a month, so a normal sign-up rate costs nothing.

```bash
npm install -g firebase-tools
firebase login
firebase use --add            # pick your project
cd firebase/functions && npm install && cd ../..
firebase functions:secrets:set HCAPTCHA_SECRET      # paste the hCaptcha secret key
firebase deploy --only firestore:rules,functions
```

Optional: to accept tokens only from your own hCaptcha site, create
`firebase/functions/.env` containing `HCAPTCHA_SITE_KEY=<your site key>` before deploying.

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
these **repository variables**. None of them are secret: web apps always ship them to the browser.

| Variable | Value |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` (e.g. `makerlab-xxxx.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |
| `VITE_HCAPTCHA_SITE_KEY` | the hCaptcha **site** key |
| `VITE_FIREBASE_FUNCTIONS_REGION` | only if you deployed the function outside `us-central1` |

Then re-run **Actions → Deploy to GitHub Pages**, or push any commit. For local development, put
the same values in a `.env.local` file at the repository root; it is ignored by git.

## How it works

- **Firestore layout**
  - `users/{uid}` holds `{ email, verified, projectIds[], maxProjects? }`.
  - `users/{uid}/projects/{id}` holds `{ name, savedAt, json }`, where `json` is the circuit.
- **Verification.** Only the `verifyCaptcha` function can create `users/{uid}` or set
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

## Testing the rules

`npm run test:rules` runs `firebase/rules.test.mjs` against the Firestore emulator. It needs
`firebase-tools` and Java.
