/**
 * Hard stop if a load/seed tool is aimed at production Firebase.
 * Production project id is fixed; staging alias defaults to lmsironlady-staging.
 */
export const PRODUCTION_PROJECT_ID = 'lmsironlady';

export function assertNotProduction(projectId, label = 'load test') {
  const id = String(projectId || '').trim();
  if (!id) {
    console.error(`[${label}] Refusing to run: project id is empty.`);
    process.exit(1);
  }
  if (id === PRODUCTION_PROJECT_ID) {
    console.error(
      `[${label}] Refusing to run against production project "${PRODUCTION_PROJECT_ID}". ` +
        'Use a staging project id (see docs/SCALE_TESTING.md).'
    );
    process.exit(1);
  }
}
