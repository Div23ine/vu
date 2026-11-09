import type { UampHeader, UampResponseAssertion } from '@vunvault/db';
import type { SqlUampWorkerRepo } from '../adapters/sql-repo.js';
import { runCheck } from './checker.js';

export class CheckHandler {
  constructor(
    private readonly repo: SqlUampWorkerRepo,
    private readonly userAgent: string,
  ) {}

  async handle(job: { monitorId: string; orgId: string; location?: string }): Promise<void> {
    const monitor = await this.repo.getMonitor(job.monitorId, job.orgId);
    if (!monitor) return;

    const outcome = await runCheck({
      target: monitor.target,
      type: monitor.type,
      warnDaysBeforeExpiry: monitor.warnDaysBeforeExpiry,
      method: monitor.method,
      timeoutMs: monitor.timeoutMs,
      headers: (monitor.headers as UampHeader[] | null) ?? [],
      requestBody: monitor.requestBody,
      assertions: (monitor.assertions as UampResponseAssertion | null) ?? null,
      keyword: monitor.keyword,
      userAgent: this.userAgent,
    });

    await this.repo.recordResult(monitor, outcome, job.location ?? null);
  }
}
