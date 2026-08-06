/** Strategy document sections — from Iron Lady Strategy template V1.3 */

export const STRATEGY_PROBLEM_SECTIONS = [
  {
    key: 'expectedOutcome',
    label: 'Expected business outcome / problem statement',
    hint: 'Clear, specific business outcome or problem statement in business perspective.',
  },
  {
    key: 'marketSegments',
    label: 'Market segments and opportunities',
    hint: 'Key opportunities: region/products, ease of penetration, revenue, competition, etc.',
  },
  {
    key: 'painPoints',
    label: 'Business / customer pain points, needs, and challenges',
    hint: 'Key pain points you plan to solve with your idea.',
  },
  {
    key: 'targetValue',
    label: 'Target customer experience / business value add',
    hint: 'Outcomes the business or customers will get from your approach.',
  },
  {
    key: 'programsProducts',
    label: 'Programs / products / services, pricing and scale',
    hint: 'Products or services, pricing, revenue opportunity, and scale for each.',
  },
];

export const STRATEGY_FULL_EXTRA_SECTIONS = [
  {
    key: 'differentiation',
    label: 'Differentiation based on enemy',
    hint: 'How you differentiate vs. the enemy — key elements.',
  },
  {
    key: 'competitorAnalysis',
    label: 'Competitor analysis — identification and monitoring',
    hint: 'Enemy, weaknesses, monitoring plan, and differentiation basis.',
  },
  {
    key: 'leadGeneration',
    label: 'Lead generation and nurturing / requirements / inputs',
    hint: 'Mechanism to gather leads, requirements, or inputs.',
  },
  {
    key: 'customerAcquisition',
    label: 'Customer acquisition / approvals / alignment',
    hint: 'Converting leads or securing approvals based on inputs and idea.',
  },
  {
    key: 'delivery',
    label: 'Delivery of programs / projects / products',
    hint: 'Step-by-step implementation plan.',
  },
  {
    key: 'programDevelopment',
    label: 'Program and content development (new and existing)',
    hint: 'Anything new to develop in alignment with the business outcome (optional if N/A).',
    required: false,
  },
  {
    key: 'issueManagement',
    label: 'Issue and escalation management',
    hint: 'Managing concerns, exceptions, communication, and risk mitigation.',
  },
  {
    key: 'qualityManagement',
    label: 'Quality management',
    hint: 'Quality systems to ensure high-quality delivery.',
  },
  {
    key: 'performanceManagement',
    label: 'Performance management — KPIs, training, capability',
    hint: 'Team performance plans, KPIs, and key trainings.',
  },
  {
    key: 'financialManagement',
    label: 'Financial management',
    hint: 'Investment needed and plan for returns including timeline.',
  },
  {
    key: 'integration',
    label: 'Integration',
    hint: 'Support from other teams/vendors and systems for smooth integration.',
  },
  {
    key: 'communityManagement',
    label: 'Community / team / cohort / taskforce management',
    hint: 'Process for managing groups in different capacities.',
  },
  {
    key: 'organizationalModel',
    label: 'Organizational model',
    hint: 'Ideal structure, leadership roles, key talent, and org chart approach.',
  },
  {
    key: 'brandPr',
    label: 'Brand and PR',
    hint: 'Impact on brand/PR, sub-brands, and leveraging outcomes for brand (optional if N/A).',
    required: false,
  },
  {
    key: 'investments',
    label: 'Key investments, sources and phases',
    hint: 'People, technology, program development, customer acquisition, and funding sources.',
  },
  {
    key: 'stakeholderManagement',
    label: 'Stakeholder management',
    hint: 'Customers, vendors, internal team, partners — communication and alignment.',
  },
];

export const STRATEGY_FULL_SECTIONS = [
  ...STRATEGY_PROBLEM_SECTIONS,
  ...STRATEGY_FULL_EXTRA_SECTIONS,
];

export function createStrategyFields(sectionDefs = STRATEGY_FULL_SECTIONS) {
  return Object.fromEntries(sectionDefs.map((section) => [section.key, '']));
}

export function isStrategyComplete(fields = {}, sectionDefs = STRATEGY_FULL_SECTIONS) {
  return sectionDefs.every((section) => {
    if (section.required === false) return true;
    return String(fields[section.key] || '').trim().length > 0;
  });
}
