'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  ApiError,
  apiPost,
} from '../../../lib/api';
import {
  CreateUampMonitorBody,
  UampMonitorResponse,
} from '@vunvault/contracts';

const MONITOR_TYPES = [
  { value: 'https', label: 'HTTPS' },
  { value: 'http', label: 'HTTP' },
  { value: 'api', label: 'REST API' },
  { value: 'keyword', label: 'Keyword' },
  { value: 'ssl', label: 'SSL certificate' },
  { value: 'domain', label: 'Domain expiry' },
  { value: 'dns', label: 'DNS' },
] as const;

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const;

export function NewMonitorForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof MONITOR_TYPES)[number]['value']>('https');
  const [target, setTarget] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('GET');
  const [intervalSeconds, setIntervalSeconds] = useState(60);
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [keyword, setKeyword] = useState('');
  const [warnDaysBeforeExpiry, setWarnDaysBeforeExpiry] = useState(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const payload = CreateUampMonitorBody.parse({
        name,
        type,
        target,
        method,
        intervalSeconds,
        timeoutMs,
        ...(type === 'keyword' ? { keyword } : {}),
        ...(['ssl', 'domain'].includes(type) ? { warnDaysBeforeExpiry } : {}),
      });
      const response = await apiPost<unknown>('/api/v1/uamp/monitors', payload);
      UampMonitorResponse.parse(response);
      router.push('/uamp');
      router.refresh();
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message || 'The API rejected this monitor configuration.');
      } else if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError('The monitor could not be created. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  const targetHint =
    type === 'domain' || type === 'dns'
      ? 'example.com'
      : type === 'ssl'
        ? 'https://example.com'
        : 'https://example.com/health';

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="monitor-name" className="mb-2 block text-sm font-medium text-slate-200">Monitor name</label>
        <input id="monitor-name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="Production API" />
      </div>

      <div>
        <label htmlFor="monitor-type" className="mb-2 block text-sm font-medium text-slate-200">Monitor type</label>
        <select id="monitor-type" value={type} onChange={(event) => setType(event.target.value as typeof type)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400">
          {MONITOR_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="monitor-target" className="mb-2 block text-sm font-medium text-slate-200">Target</label>
        <input id="monitor-target" required maxLength={2048} value={target} onChange={(event) => setTarget(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder={targetHint} />
        <p className="mt-2 text-xs text-slate-500">Private and reserved network destinations are blocked by the monitor executor.</p>
      </div>

      {['http', 'https', 'api', 'keyword'].includes(type) && (
        <div>
          <label htmlFor="monitor-method" className="mb-2 block text-sm font-medium text-slate-200">HTTP method</label>
          <select id="monitor-method" value={method} onChange={(event) => setMethod(event.target.value as typeof method)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400">
            {METHODS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      )}

      {type === 'keyword' && (
        <div>
          <label htmlFor="monitor-keyword" className="mb-2 block text-sm font-medium text-slate-200">Expected keyword</label>
          <input id="monitor-keyword" required maxLength={200} value={keyword} onChange={(event) => setKeyword(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="All systems operational" />
        </div>
      )}

      {['ssl', 'domain'].includes(type) && (
        <div>
          <label htmlFor="expiry-warning" className="mb-2 block text-sm font-medium text-slate-200">Expiry warning (days)</label>
          <input id="expiry-warning" type="number" min={1} max={90} required value={warnDaysBeforeExpiry} onChange={(event) => setWarnDaysBeforeExpiry(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="monitor-interval" className="mb-2 block text-sm font-medium text-slate-200">Check interval (seconds)</label>
          <input id="monitor-interval" type="number" min={30} max={86400} required value={intervalSeconds} onChange={(event) => setIntervalSeconds(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" />
        </div>
        <div>
          <label htmlFor="monitor-timeout" className="mb-2 block text-sm font-medium text-slate-200">Timeout (milliseconds)</label>
          <input id="monitor-timeout" type="number" min={1000} max={60000} required value={timeoutMs} onChange={(event) => setTimeoutMs(Number(event.target.value))} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" />
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5">
        <button type="button" onClick={() => router.push('/uamp')} className="rounded-xl border border-slate-700 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? 'Creating monitor…' : 'Create monitor'}
        </button>
      </div>
    </form>
  );
}
