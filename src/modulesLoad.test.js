// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

/**
 * Every module evaluates.
 *
 * `npm run build` does not catch an identifier that is used but never imported.
 * Rollup treats the unknown name as a global, emits nothing, and the bundle is
 * produced — then the page goes blank on load. That is not hypothetical: an
 * icon import was removed while the Contact list still referenced it, and the
 * build reported success.
 *
 * Importing a module runs everything at its top level, which is where lookup
 * tables like `CONTACT_ICONS = { card: CreditCard }` live. A missing name there
 * throws here instead of in front of a learner.
 *
 * This is a floor, not a substitute for a linter: a name used only inside a
 * function body still slips through, because nothing calls it. ESLint's
 * `no-undef` is the real answer — see the note in the failure message.
 */

const modules = import.meta.glob('./{components,pages,data,services,utils,hooks}/**/*.{js,jsx}');

const paths = Object.keys(modules).filter((p) => !/\.test\.(js|jsx)$/.test(p) && !/__/.test(p));

describe('every module can be loaded', () => {
  it('has modules to check at all', () => {
    // A glob that silently matched nothing would make this whole file a no-op.
    expect(paths.length).toBeGreaterThan(100);
  });

  /*
   * One test, not 288.
   *
   * This began as `it.each`, which made each module its own test with its own
   * 5s budget — and AdminOverviewCharts, which pulls the whole of recharts,
   * blew it about one run in five. Raising the per-test timeout to 20s did not
   * hold either; it simply failed less often, which is worse, because an
   * intermittent red is one people learn to re-run rather than read.
   *
   * The cost is the transform, and it is paid once whether it is split across
   * 288 tests or not. So: one test, one generous budget, every module tried,
   * and the names of whatever failed reported together.
   */
  it('every module evaluates', async () => {
    const failures = [];
    for (const path of paths) {
      try {
        await modules[path]();
      } catch (err) {
        failures.push(`${path}: ${err?.message || err}`);
      }
    }
    expect(
      failures,
      'A "X is not defined" here usually means an import was removed while ' +
        'something still used it. The build does not catch that.'
    ).toEqual([]);
  }, 180000);
});
