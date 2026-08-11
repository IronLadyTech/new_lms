# Session handoff — open items

## Done (uncommitted, in working tree)

- **Submission/review fixes** — resubmit permission bug (rules + `clearReviewFieldsForResubmit`),
  CX pending-queue completeness, `submissionUnlocksNext` corrected
- **Mobile fixes** — CX bottom-nav clipping, profile email overflow, batch select overflow,
  notification sheet redesign (true bottom sheet + branded empty state)
- **Zoho batch preview** — `functions/zohoBatchSync.js` (read-only, no writes) +
  admin panel button in `ZohoIntegration.jsx`
- **Docs** — `LMS_FEATURE_REVIEW_GUIDE.md/.pdf` (written reference),
  `Iron-Lady-LMS-Walkthrough.pdf` (23-slide deck, 31 real screenshots, live links)
- **Screenshots** — `docs/screenshots/` (32 PNGs, captured from the live app)

## Verify next

1. **Firestore rules deployed?** Test: log in as `MBW_Test_User_Yaswanth`, open MBW →
   *27 Principles Video* (already in "Needs Improvement") → resubmit.
   Pass = saves and flips to Submitted. Fail = `permission-denied` in console.

## Open, ranked

2. **47 MBW submissions** sitting unreviewed in the CX queue
3. **Zoho data structure** — cohort numbers are being written into the programme field
   (`101/102/…/144 Board Members Program`). Fix at source: separate batch field per
   programme instead of positional comma-lists. Blocks batch automation.
4. **No tests / no CI** — flagged as #1 risk in `QA_TEST_PLAN.md`
5. **Mobile cluster still open** — `.cx-count-btn` ~24px, `.cx-taskwise-row` has no phone
   breakpoint, modal close buttons ~24px, no sticky column on participant matrix,
   cohort-journey stacked bar unreadable on phone
6. **Commit the work** — ~55 files uncommitted
7. **CX has no CSV export** (admin has four)
8. **Foundation debt** — 12 breakpoints vs 3 documented, `--z-*` tokens unused,
   no global `prefers-reduced-motion`, five separate modal implementations

## Security

- **Rotate the password** for `suvarna@iamironlady.com` — it was pasted in a chat transcript
- `docs/screenshots/.test-creds.local` holds it locally (gitignored — verified)
- Screenshots contain **real names and emails** (Users, Batches, review slides).
  Review before sharing the walkthrough deck.

## Test data created

One submission as `suvarna@iamironlady.com` — 100BM → *Core Story Practice Session*,
file `core-story-sample.txt` (66 bytes, dummy). Delete if unwanted.

## Rebuilding the deck

Source: `lms-walkthrough-deck.html`. Serve the project root and print:
`python -m http.server 8899` then load `/lms-walkthrough-deck.html` and print to PDF.
Live links point at `https://new-lms-three-topaz.vercel.app`.
