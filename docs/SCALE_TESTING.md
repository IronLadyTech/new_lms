# Scale & device testing

Closes the gaps called out in `LMS_TEST_REPORT.html` (writing at scale, staff concurrency timings, Safari/real devices, live-service volume, pen-test scope). **Never run volume tools against production (`lmsironlady`).**

## Staging status

| Item | Status |
|---|---|
| Production project | `lmsironlady` (`.firebaserc` → `default`) |
| Staging project | **`lmsironlady-staging` created** — Firestore blocked until **business links Blaze billing** |
| Emulator project id | `lmsironlady-rules-test` (local only) |

### Discover whether staging already exists

1. Open [Firebase Console](https://console.firebase.google.com) while signed into the Iron Lady Google account, **or** run `firebase projects:list` after `firebase login`.
2. Look for a non-prod LMS project (`*-staging`, `*-dev`, `*-qa`, etc.).
3. If one exists, update `.firebaserc` `staging` alias to that project id and say so in a PR.
4. If none exists, create one (owner required):

### Create staging (checklist)

1. Firebase Console → Add project → id e.g. `lmsironlady-staging` (must **not** be `lmsironlady`).
2. Enable **Authentication** (Email/Password), **Firestore**, **Storage**.
3. From this repo: deploy rules/indexes with `firebase use staging` then deploy (never `default`/prod by mistake).
4. Copy [`.env.staging.example`](../.env.staging.example) → `.env.staging` (gitignored) and fill web app keys from Project settings.
5. Create a throwaway staff user (`load-admin@example.com` or similar) and set custom claims / Firestore `users/{uid}` role as you do in prod for CX/admin.
6. Optional: place a service-account JSON at `.secrets/staging-sa.json` (gitignored) for Admin SDK seed/write load.

## What each command measures

| Command | Target | Answers |
|---|---|---|
| `npm run loadtest` | Emulator | Screen timing / read cost at seeded volume |
| `npm run loadtest:writes` | Emulator | Write path shape only — **emulator caps ~0.2 writes/s**; not capacity |
| `npm run loadtest:writes:staging` | Staging | Real write throughput (submissions/sec, p95) |
| GitHub Actions `Load — staff concurrency` | Staging | 4–8 **separate** runners opening CX Reviews |
| `npm run test:e2e` (webkit project) | Preview build | Safari engine smoke on public auth pages |

## Honesty about concurrency on one laptop

Eight Chromium instances on a single machine share CPU, RAM, and the Firestore emulator/process. Timings that climb with browser count measure the **laptop**, not the product. The report’s “8 staff” success/fail comparison is valid; the millisecond curve is not. Use the multi-runner workflow for quantified staff concurrency.

## Safety rails

- Staging scripts **exit non-zero** if the project id is `lmsironlady`.
- Seeds use synthetic emails only (`load-*@example.com`).
- Staging load workflows are `workflow_dispatch` only — not on every push to `main`.

## Reproducing write-load (staging)

```bash
# Once: service account with Firestore write on staging
export GOOGLE_APPLICATION_CREDENTIALS=.secrets/staging-sa.json
export LOADTEST_PROJECT_ID=lmsironlady-staging   # must match .firebaserc staging

npm run loadtest:writes:staging -- 50 3
npm run loadtest:writes:staging -- 100 3
npm run loadtest:writes:staging -- 250 3
```

## Pen-test

See [PENTEST_SCOPE.md](./PENTEST_SCOPE.md). Rules tests are not a penetration test.
