import type { FastifyPluginAsync } from 'fastify';
import accountSecurityRoutes from './account-security/index.js';
import accountSessionsRoutes from './account-sessions/index.js';
import billingRoutes from './billing/index.js';
import accountSettingsRoutes from './account-settings/index.js';
import clientRoutes from './client/index.js';
import invitationsPublicRoutes from './users/invitations-public.js';
import usersRoutes from './users/index.js';
import authRoutes from './auth/index.js';
import checkoutRoutes from './checkout/index.js';
import webhooksRoutes from './webhooks/index.js';
import paymentsAdminRoutes from './payments-admin/index.js';
import scansRoutes from './scans/index.js';
import contentRoutes from './content/index.js';
import studioRoutes from './studio/index.js';
import dashboardRoutes from './dashboard/index.js';
import nodesRoutes from './nodes/index.js';
import advisoriesRoutes from './advisories/index.js';
import auditReadRoutes from './audit/index.js';
import publicRoutes from './public/index.js';
import adminBadgesRoutes from './admin-badges/index.js';
import storeRoutes from './store/index.js';
import newsletterRoutes from './newsletter/index.js';
import contactAdminRoutes from './contact-admin/index.js';
import internalScansRoutes from './internal-scans/index.js';
import scanStreamRoutes from './scan-stream/index.js';
import diagnosticsRoutes from './diagnostics/index.js';

/**
 * `/api/v1` aggregator.
 *
 * Every task adds exactly one `register` line here and nothing else — the prefix,
 * the type provider and the plugin scope are already set up by `buildApp`.
 */
const v1Routes: FastifyPluginAsync = async (app) => {
  await app.register(accountSecurityRoutes); // Task 27
  await app.register(accountSettingsRoutes); // Task 28
  await app.register(accountSessionsRoutes); // Task 29
  await app.register(clientRoutes); // Task 30
  await app.register(usersRoutes); // Task 31
  await app.register(billingRoutes); // Task 32
  await app.register(invitationsPublicRoutes); // Task 31
  await app.register(authRoutes); // Task 26
  await app.register(checkoutRoutes); // Task 33
  await app.register(webhooksRoutes); // Task 34
  await app.register(paymentsAdminRoutes); // Task 34
  await app.register(scansRoutes); // Task 35
  await app.register(contentRoutes); // Task 36
  await app.register(studioRoutes); // Task 36
  await app.register(dashboardRoutes); // Task 37
  await app.register(nodesRoutes); // Task 37
  await app.register(advisoriesRoutes); // Task 38
  await app.register(auditReadRoutes); // Task 39
  await app.register(publicRoutes); // Task 40
  await app.register(adminBadgesRoutes); // Task 40
  await app.register(storeRoutes); // Task 40c
  await app.register(newsletterRoutes); // Task 40c
  await app.register(contactAdminRoutes); // Task 40f
  await app.register(internalScansRoutes); // Task 40g
  await app.register(scanStreamRoutes); // Task 95
  await app.register(diagnosticsRoutes); // Revision 2 addendum A2.4
};

export default v1Routes;
