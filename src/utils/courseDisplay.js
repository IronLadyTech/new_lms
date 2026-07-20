/** Display metadata for course cards (aligned with COMPANY_CONTEXT.md). */
export const COURSE_PROGRAM_META = {
  MBW: {
    tag: 'C-Suite track',
    duration: '1 year',
    format: 'Quarterly weekends + online',
    cover: '/programs/mbw.png',
  },
  LEP: {
    tag: 'Essentials',
    duration: '4 weeks',
    format: '2 live days + weekly sessions',
    cover: '/programs/lep.png',
  },
  '100BM': {
    tag: 'Board members',
    duration: '6 months',
    format: 'Online cohort',
    cover: '/programs/100bm.png',
  },
};

export function normalizeProgramCode(code) {
  const key = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (key === '100BOARDMEMBERS') return '100BM';
  return key;
}

export function getCourseProgramMeta(code) {
  const normalized = normalizeProgramCode(code);
  return COURSE_PROGRAM_META[normalized] || { tag: 'Program', duration: 'Self-paced', format: 'Online' };
}

/** Brand cover art for LEP / 100BM / MBW cards when no custom thumbnail is set. */
export function getProgramCoverSrc(code) {
  return getCourseProgramMeta(code).cover || '';
}

/** Public marketing pages on iamironlady.com (for non-enrolled learners). */
export const PROGRAM_MARKETING_URLS = {
  LEP: 'https://iamironlady.com/individualPrograms/Leadership_Essentials_Program',
  '100BM': 'https://iamironlady.com/100-board-members',
  MBW: 'https://iamironlady.com/individualPrograms/C-Suite_League_%E2%80%93_Master_of_Business_Warfare',
};

export function getProgramMarketingUrl(code) {
  return PROGRAM_MARKETING_URLS[normalizeProgramCode(code)] || null;
}
