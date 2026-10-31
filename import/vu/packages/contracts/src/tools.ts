import { z } from 'zod';

/**
 * Open tooling + waitlist contracts.
 *
 * `GET /api/v1/public/tools` answers the open-tools grid on the Products page;
 * `fileUrl` is nullable because a tool is listed before its artifact ships —
 * the UI then offers a waitlist signup for that tool instead of a download.
 * `POST /api/v1/public/waitlist` records the signup (empty `topic` = the
 * general "page coming soon" waitlist).
 */

export const OpenToolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().max(40)),
  sizeLabel: z.string().min(1).nullable(),
  fileUrl: z.string().min(1).nullable(),
  icon: z.string().min(1),
});
export type OpenTool = z.infer<typeof OpenToolSchema>;

export const OpenToolsResponseSchema = z.object({ data: z.array(OpenToolSchema) });
export type OpenToolsResponse = z.infer<typeof OpenToolsResponseSchema>;

export const WaitlistBodySchema = z.object({
  email: z.string().email(),
  /** Open-tool id (or empty) the visitor wants first access to. */
  topic: z.string().max(120).optional(),
});
export type WaitlistBody = z.infer<typeof WaitlistBodySchema>;
