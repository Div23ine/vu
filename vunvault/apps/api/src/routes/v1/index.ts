import type { FastifyPluginAsync } from 'fastify';
import accountSecurityRoutes from './account-security';
import accountSessionsRoutes from './account-sessions';
import billingRoutes from './billing';
import accountSettingsRoutes from './account-settings';
import clientRoutes from './client';
import invitationsPublicRoutes from './users/invitations-public';
import usersRoutes from './users';
import authRoutes from './auth';
import checkoutRoutes from './checkout';
import webhooksRoutes from './webhooks';
import paymentsAdminRoutes from './payments-admin';
import scansRoutes from './scans';
import contentRoutes from './content';
import studioRoutes from './studio';
import dashboardRoutes from './dashboard';
import nodesRoutes from './nodes';
import advisoriesRoutes from './advisories';
import auditReadRoutes from './audit';
import publicRoutes from './public';
import adminBadgesRoutes from './admin-badges';
import storeRoutes from './store';
import newsletterRoutes from './newsletter';
import contactAdminRoutes from './contact-admin';
import internalScansRoutes from './internal-scans';
import scanStreamRoutes from './scan-stream';

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
