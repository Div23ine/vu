import { adminAdvisoriesHandlers } from './admin-advisories';
import { adminAuditHandlers } from './admin-audit';
import { adminContactHandlers } from './admin-contact';
import { adminContentHandlers } from './admin-content';
import { adminProfileHandlers } from './admin-profile';
import { adminScansHandlers } from './admin-scans';
import { adminUsersHandlers } from './admin-users';
import { advisoriesHandlers } from './advisories';
import { authHandlers } from './auth';
import { authMiscHandlers } from './auth-misc';
import { billingHandlers } from './billing';
import { consentHandlers } from './consent';
import { contactHandlers } from './contact';
import { dashboardHandlers } from './dashboard';
import { newsletterHandlers } from './newsletter';
import { onboardingHandlers } from './onboarding';
import { pentestHandlers } from './pentest';
import { profileHandlers } from './profile';
import { publicContentHandlers } from './public-content';
import { scansHandlers } from './scans';
import { securityHandlers } from './security';
import { storeHandlers } from './store';
import { studioHandlers } from './studio';

/**
 * The single aggregated handler list.
 *
 * Later tasks append exactly one import and one spread here so the mock layer
 * stays reviewable at a glance.
 */
export const handlers = [
  ...authHandlers,
  ...authMiscHandlers,
  ...onboardingHandlers,
  ...billingHandlers,
  ...securityHandlers,
  ...profileHandlers,
  ...scansHandlers,
  ...advisoriesHandlers,
  ...studioHandlers,
  ...dashboardHandlers,
  // admin-users BEFORE admin-scans: its filtered GET /admin/users supersedes
  // the roster handler Task 77 parked in admin-scans.ts (MSW first-match).
  ...adminUsersHandlers,
  ...adminScansHandlers,
  ...adminAdvisoriesHandlers,
  ...adminContentHandlers,
  ...adminAuditHandlers,
  ...adminProfileHandlers,
  ...adminContactHandlers,
  ...pentestHandlers,
  ...publicContentHandlers,
  ...storeHandlers,
  ...newsletterHandlers,
  ...contactHandlers,
  ...consentHandlers,
];
