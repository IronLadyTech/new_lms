#!/usr/bin/env bash
# Re-seeds at each volume and re-runs the timing test, so the numbers form a curve.
set -e
SUID=$(curl -s -X POST "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-key" \
  -H "Content-Type: application/json" \
  -d '{"email":"load-admin@example.com","password":"load-test-pw-1","returnSecureToken":true}' \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).localId||''))")
for N in "$@"; do
  curl -s -X DELETE "http://127.0.0.1:8080/emulator/v1/projects/lmsironlady-rules-test/databases/(default)/documents" > /dev/null
  STAFF_UID=$SUID node load-test/seed.js "$N" 20 8 2>&1 | tail -1
  echo "### LEARNERS=$N"
  npx playwright test --config playwright.load.config.js loadTest -g "screen timing" 2>&1 | grep -E "LOADSTATS:|failed|Error"
done
