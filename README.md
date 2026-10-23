# Marbles

A daily time-awareness tracker: log blocks of time in 30-minute steps as Purposeful (mint), Productive (sky blue), Unwanted (coral) or Wasted (slate) and see the day as a jar of marbles. React 19 + Vite + TypeScript SPA hosted on GitHub Pages, with Firebase Auth and Firestore (Spark plan, no Functions) for sync. See [SPEC.md](./SPEC.md) and [PLAN.md](./PLAN.md).

Live app: https://dd123zzz.github.io/marbles/

## Local development

```sh
npm install
npm run dev        # http://localhost:5173/marbles/
```

`.env.local` defaults to **demo mode** (`VITE_DEMO=true`): sign-in always succeeds as a fake user and data lives in `localStorage` (`marbles-demo`); Firebase is never loaded. To use real Firebase, set `VITE_DEMO=false` and fill in the `VITE_FIREBASE_*` values (see `.env.example`). Set `VITE_USE_EMULATOR=true` to talk to the local Auth (9099) and Firestore (8080) emulators.

## Scripts

| Script                | What it does                                                          |
| --------------------- | --------------------------------------------------------------------- |
| `npm run dev`         | Vite dev server                                                       |
| `npm run build`       | Typecheck and production build to `dist/`                             |
| `npm run lint`        | ESLint                                                                |
| `npm run format`      | Prettier (write); `format:check` verifies                             |
| `npm run typecheck`   | `tsc -b --noEmit` (app, config and rules tests)                       |
| `npm test`            | Unit tests (Vitest, `TZ=America/Los_Angeles`)                         |
| `npm run test:rules`  | Firestore security-rules tests in the emulator (needs Java 21+)       |

## Install as app

Marbles is an installable PWA (service worker only in production builds, not `npm run dev`). On Android/desktop Chrome use the install button; on iOS Safari use Share → Add to Home Screen. New versions show a "Reload" banner. Regenerate icons from `public/icon.svg` with `npm run generate-pwa-assets`.

## CI / deployment

`.github/workflows/ci.yml` runs lint, format, typecheck, tests and build, the rules tests, and on `main` deploys `dist/` to GitHub Pages. On `main`, its `deploy-rules` job deploys `firestore.rules` only after the checks and rules tests pass and only when `firestore.rules` or `firebase.json` changed. `deploy-rules.yml` is a manual (`workflow_dispatch`) fallback.

Repository **variables** (Settings → Secrets and variables → Actions → Variables):
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and optionally `VITE_APPCHECK_SITE_KEY` (see [App Check](#app-check)).

Repository **secret**: `FIREBASE_SERVICE_ACCOUNT` — JSON key of a service account allowed to deploy rules (role *Firebase Rules Admin*).

## Firebase console checklist

- [ ] Create a project on the Spark plan and register a web app (copy its config into the variables above).
- [ ] Authentication → Sign-in method: enable **Google** and **Email/Password**.
- [ ] Authentication → Settings → Authorized domains: add `<user>.github.io`.
- [ ] Firestore Database: create in **production mode** (rules are deployed from this repo).
- [ ] Google Cloud console → Credentials: restrict the browser API key by HTTP referrer (`https://<user>.github.io/*`, plus `http://localhost:*` for dev).
- [ ] Create the service account for `FIREBASE_SERVICE_ACCOUNT` and add it as a repo secret.
- [ ] GitHub repo Settings → Pages → Source: **GitHub Actions**.
- [ ] (Optional) App Check: see the section below.

## App Check (optional)

App Check adds reCAPTCHA v3 tokens to Firestore and Auth requests to limit abuse of the shared quota. It is only loaded in real Firebase mode, and it is skipped when `VITE_APPCHECK_SITE_KEY` is unset. Setup (done by you, in the consoles):

1. Create a reCAPTCHA v3 key (or Enterprise, if the console offers it) for `dd123zzz.github.io` and `localhost`.
2. Firebase console → App Check → register the web app with that key.
3. Add the GitHub repo variable `VITE_APPCHECK_SITE_KEY` (Settings → Secrets and variables → Actions → Variables). The next deploy picks it up.
4. For local dev (optional), create a debug token, add it to `.env.local` as `VITE_APPCHECK_DEBUG_TOKEN=<uuid>` (never commit it), and register the same token under App Check → Apps → Manage debug tokens. The debug token is only used in `npm run dev`.
5. Monitor the App Check metrics for Firestore for 1–2 weeks while enforcement is **off**.
6. Enforce App Check for Firestore in the console. Enforcement is reversible there if users are blocked.
