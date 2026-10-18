# Marbles

A daily time-awareness tracker: log each 30-minute slot as Wanted, Neutral or Regret and see the day as a jar of marbles. React 19 + Vite + TypeScript SPA hosted on GitHub Pages, with Firebase Auth and Firestore (Spark plan, no Functions) for sync. See [SPEC.md](./SPEC.md) and [PLAN.md](./PLAN.md).

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

## CI / deployment

`.github/workflows/ci.yml` runs lint, format, typecheck, tests and build, the rules tests, and on `main` deploys `dist/` to GitHub Pages. `deploy-rules.yml` deploys `firestore.rules` when it changes (or manually).

Repository **variables** (Settings → Secrets and variables → Actions → Variables):
`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.

Repository **secret**: `FIREBASE_SERVICE_ACCOUNT` — JSON key of a service account allowed to deploy rules (role *Firebase Rules Admin*).

## Firebase console checklist

- [ ] Create a project on the Spark plan and register a web app (copy its config into the variables above).
- [ ] Authentication → Sign-in method: enable **Google** and **Email/Password**.
- [ ] Authentication → Settings → Authorized domains: add `<user>.github.io`.
- [ ] Firestore Database: create in **production mode** (rules are deployed from this repo).
- [ ] Google Cloud console → Credentials: restrict the browser API key by HTTP referrer (`https://<user>.github.io/*`, plus `http://localhost:*` for dev).
- [ ] Create the service account for `FIREBASE_SERVICE_ACCOUNT` and add it as a repo secret.
- [ ] GitHub repo Settings → Pages → Source: **GitHub Actions**.
