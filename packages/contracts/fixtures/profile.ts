import type { ClientProfile } from '../src/profile.js';

/** Client portal profile fixture for Acme Fintech Ltd. */
export const clientProfile: ClientProfile = {
  id: 'c0000000-0000-4000-8000-000000000011',
  fullName: 'Jane Wanjiru',
  jobTitle: 'Head of Information Security',
  email: 'jane.wanjiru@acmefintech.co.ke',
  phone: null,
  clientCode: 'VV-CL-48210',
  company: {
    name: 'Acme Fintech Ltd',
    primaryDomain: null,
    industry: 'financial_services_fintech',
  },
  plan: {
    name: 'Enterprise Client',
    status: 'active',
  },
  stats: {
    engagements: 7,
    openFindings: 12,
    nextAssessmentInDays: 14,
  },
  updatedAt: '2026-08-18T09:14:00Z',
};
