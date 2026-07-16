/** Display metadata for course cards (aligned with COMPANY_CONTEXT.md). */
export const COURSE_PROGRAM_META = {
  MBW: {
    tag: 'C-Suite track',
    duration: '1 year',
    format: 'Quarterly weekends + online',
  },
  LEP: {
    tag: 'Essentials',
    duration: '4 weeks',
    format: '2 live days + weekly sessions',
  },
  '100BM': {
    tag: 'Board members',
    duration: '6 months',
    format: 'Online cohort',
  },
};

export function getCourseProgramMeta(code) {
  return COURSE_PROGRAM_META[code] || { tag: 'Program', duration: 'Self-paced', format: 'Online' };
}
