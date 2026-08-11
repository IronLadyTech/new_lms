import AxeBuilder from '@axe-core/playwright';

const SERIOUS = ['critical', 'serious'];

/**
 * WCAG 1.4.3 exempts "inactive user interface components" from the contrast
 * minimum. axe cannot always tell, and flags disabled controls whose text is
 * dimmed on purpose. Raising their contrast enough to satisfy the checker would
 * make them stop reading as disabled, so the honest fix is to apply the
 * exemption here rather than distort the design.
 *
 * Narrow by design: only colour-contrast, only on genuinely disabled elements.
 */
function isExemptDisabledNode(node) {
  // Read the element axe actually failed, from the snapshot it captured.
  // Re-querying by node.target is unreliable: axe emits selectors like ".btn"
  // that match many elements, so querySelector can inspect the wrong one — and
  // whether a control is disabled often depends on load timing, which made the
  // check pass or fail at random.
  const html = node.html || '';
  return /\sdisabled(?=[\s/>=])/i.test(html) || /aria-disabled=["']true["']/i.test(html);
}

/** Serious/critical violations, with the disabled-control exemption applied. */
export async function scanForViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const violations = results.violations.filter((v) => SERIOUS.includes(v.impact));

  const kept = [];
  for (const violation of violations) {
    if (violation.id !== 'color-contrast') {
      kept.push(violation);
      continue;
    }
    const nodes = violation.nodes.filter((node) => !isExemptDisabledNode(node));
    if (nodes.length) kept.push({ ...violation, nodes });
  }
  return kept;
}

/** Readable failure output — axe's raw JSON is unusable in CI logs. */
export function describeViolations(violations) {
  return violations
    .map((v) => {
      const where = v.nodes
        .slice(0, 4)
        .map((n) => {
          const target = n.target.join(' ');
          const data = n.any?.[0]?.data;
          const detail = data?.contrastRatio
            ? ` (${data.fgColor} on ${data.bgColor} = ${data.contrastRatio})`
            : '';
          return `${target}${detail}`;
        })
        .join('\n         ');
      return `[${v.impact}] ${v.id}: ${v.help}\n      at: ${where}`;
    })
    .join('\n');
}
