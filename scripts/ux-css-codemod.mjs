/**
 * UX audit H-1 / H-2 / H-3 — one-shot CSS token migration for index.css
 * Run: node scripts/ux-css-codemod.mjs
 */
import fs from 'node:fs';

const PATH = new URL('../src/index.css', import.meta.url);
let css = fs.readFileSync(PATH, 'utf8');

const TOKEN_BLOCK = `  /* Type scale — 7 steps (UX audit H-1). Floor is 12px. */
  --text-xs: 0.75rem;   /* 12px — badges, nav labels, meta */
  --text-sm: 0.875rem;  /* 14px — secondary, captions */
  --text-base: 1rem;    /* 16px — body */
  --text-lg: 1.125rem;  /* 18px */
  --text-xl: 1.375rem;  /* 22px */
  --text-2xl: 1.75rem;  /* 28px */
  --text-3xl: 2.25rem;  /* 36px */
  /* Extra spacing steps so real UI gaps map to tokens (H-3) */
  --space-2xs: 6px;
  --space-2sm: 12px;
  /* Breakpoint reference (H-2) — use in comments; media queries use px literals */
  --bp-sm: 640px;
  --bp-md: 768px;
  --bp-lg: 1024px;
`;

if (!css.includes('--text-xs:')) {
  css = css.replace(
    `  --space-2xl: 48px;\n`,
    `  --space-2xl: 48px;\n${TOKEN_BLOCK}`
  );
}

/** Map a rem/px font-size to nearest type token (raise sub-12px to xs). */
function mapFontSize(raw) {
  const v = raw.trim();
  if (v.startsWith('var(') || v.includes('clamp') || v.includes('max(') || v.includes('min(')) {
    return null;
  }
  let px;
  if (v.endsWith('rem')) px = parseFloat(v) * 16;
  else if (v.endsWith('px')) px = parseFloat(v);
  else if (v.endsWith('em')) return null;
  else return null;
  if (Number.isNaN(px)) return null;

  if (px <= 13) return 'var(--text-xs)';
  if (px <= 15) return 'var(--text-sm)';
  if (px <= 17) return 'var(--text-base)';
  if (px <= 20) return 'var(--text-lg)';
  if (px <= 25) return 'var(--text-xl)';
  if (px <= 32) return 'var(--text-2xl)';
  return 'var(--text-3xl)';
}

let fontReplacements = 0;
css = css.replace(/font-size:\s*([^;}+]+);/g, (full, value) => {
  const mapped = mapFontSize(value);
  if (!mapped) return full;
  if (value.trim() === mapped) return full;
  fontReplacements += 1;
  return `font-size: ${mapped};`;
});

/** Layout breakpoints only — leave component min-widths (44px, 200px, …) alone. */
const MAX_BP_MAP = {
  '280px': '639px',
  '320px': '639px',
  '420px': '639px',
  '480px': '639px',
  '520px': '639px',
  '560px': '639px',
  '640px': '639px', // ≤639 = below sm; pairs with min-width: 640px
  '720px': '767px',
  '767px': '767px',
  '768px': '767px', // avoid 768 overlap with min-width:768
  '900px': '1023px',
  '960px': '1023px',
  '1023px': '1023px',
  '1180px': '1023px',
  '1240px': '1240px', // content max — keep
};

const MIN_BP_MAP = {
  '480px': '640px',
  '560px': '640px',
  '640px': '640px',
  '720px': '768px',
  '767px': '768px',
  '768px': '768px',
  '900px': '1024px',
  '960px': '1024px',
  '1023px': '1024px',
  '1024px': '1024px',
  '1180px': '1024px',
  '1240px': '1240px',
};

let bpReplacements = 0;
css = css.replace(/@media\s*\(([^)]+)\)/g, (full, query) => {
  const next = query.replace(
    /(max-width|min-width):\s*([0-9.]+px)/g,
    (m, dir, px) => {
      const map = dir === 'max-width' ? MAX_BP_MAP : MIN_BP_MAP;
      if (!(px in map)) return m;
      const mapped = map[px];
      if (mapped === px) return m;
      bpReplacements += 1;
      return `${dir}: ${mapped}`;
    }
  );
  return `@media (${next})`;
});

/** Exact rem → space token for padding/margin/gap (single value or sides). */
const REM_TO_SPACE = {
  '0.125rem': 'var(--space-xs)',
  '0.2rem': 'var(--space-xs)',
  '0.25rem': 'var(--space-xs)',
  '0.35rem': 'var(--space-2xs)',
  '0.4rem': 'var(--space-2xs)',
  '0.45rem': 'var(--space-2xs)',
  '0.5rem': 'var(--space-sm)',
  '0.55rem': 'var(--space-sm)',
  '0.6rem': 'var(--space-sm)',
  '0.65rem': 'var(--space-2sm)',
  '0.7rem': 'var(--space-2sm)',
  '0.75rem': 'var(--space-2sm)',
  '0.85rem': 'var(--space-2sm)',
  '1rem': 'var(--space-md)',
  '1.25rem': 'var(--space-md)',
  '1.5rem': 'var(--space-lg)',
  '2rem': 'var(--space-xl)',
  '2.5rem': 'var(--space-xl)',
  '3rem': 'var(--space-2xl)',
};

function mapSpacingValue(token) {
  const t = token.trim();
  if (!t || t === '0' || t === 'auto' || t.startsWith('var(') || t.includes('calc') || t.includes('env(')) {
    return t;
  }
  if (REM_TO_SPACE[t]) return REM_TO_SPACE[t];
  return t;
}

let spaceReplacements = 0;
css = css.replace(
  /(padding|margin|gap|row-gap|column-gap):\s*([^;{]+);/g,
  (full, prop, value) => {
    if (value.includes('var(--space')) return full;
    const parts = value.trim().split(/\s+/);
    const mapped = parts.map(mapSpacingValue);
    if (mapped.join(' ') === parts.join(' ')) return full;
    // only count if at least one part changed to a token
    if (!mapped.some((p) => p.startsWith('var(--space'))) return full;
    spaceReplacements += 1;
    return `${prop}: ${mapped.join(' ')};`;
  }
);

fs.writeFileSync(PATH, css);
console.log(
  JSON.stringify(
    { fontReplacements, bpReplacements, spaceReplacements, bytes: css.length },
    null,
    2
  )
);
