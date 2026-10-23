import type { FastifyPluginAsync } from 'fastify';
import accountSecurityRoutes from './account-security/index';
import accountSessionsRoutes from './account-sessions/index';
import billingRoutes from './billing/index';
import accountSettingsRoutes from './account-settings/index';
import clientRoutes from './client/index';
import invitationsPublicRoutes from './users/invitations-public';
import usersRoutes from './users/index';
import authRoutes from './auth/index';
import checkoutRoutes from './checkout/index';
import webhooksRoutes from './webhooks/index';
import paymentsAdminRoutes from './payments-admin/index';
import scansRoutes from './scans/index';
import contentRoutes from './content/index';
import studioRoutes from './studio/index';
import dashboardRoutes from './dashboard/index';
import nodesRoutes from './nodes/index';
import advisoriesRoutes from './advisories/index';
import auditReadRoutes from './audit/index';
import publicRoutes from './public/index';
import adminBadgesRoutes from './admin-badges/index';
import storeRoutes from './store/index';
import newsletterRoutes from './newsletter/index';
import contactAdminRoutes from './contact-admin/index';
import internalScansRoutes from './internal-scans/index';
import scanStreamRoutes from './scan-stream/index';

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
};

export default v1Routes;
