# 0005 — Real-time transports: SSE for observation, WebSocket only for the scan terminal

**Status:** Accepted
**Date:** 2026-10 (Tasks 93–96 shipped; recorded in Task 109)
**Deciders:** Platform + Security

## Context

Three surfaces needed live data (Tasks 93–96): the admin audit tail, the
Zero-Day desk's broadcast progress, and the scan terminal. They are not the
same problem. The first two are pure observation — the browser never says
anything back. The third is a control channel: an operator can abort or kill a
running scan, which is the platform's most dangerous verb set. Choosing one
transport for all three would either give a read-only log a write channel it
does not need, or force the terminal to fight a one-way pipe.

## Decision

1. **SSE for observation, WebSocket for control — and nothing else.** The
   audit tail and broadcast progress are `text/event-stream` over plain HTTP:
   every proxy, WAF and load balancer in front of the API already handles it,
   `EventSource` reconnects natively, and there is no write direction to
   secure. The scan terminal is the ONLY WebSocket in the system, and its
   inbound direction accepts exactly four frames.
2. **Replay is a first-class property, implemented differently per transport.**
   SSE carries `id: <seq>` on every entry frame, so a reconnecting client's
   `Last-Event-ID` replays up to 200 missed entries from the database before
   going live. The scan relay instead snapshots on connect: subscribe FIRST,
   read the controller's `scan:buf:<jobId>` list, then flush what arrived
   mid-replay, deduped against a line-`seq` high-water mark. Progress frames
   are never replayed — a stale percentage misdescribes the present.
3. **Every frame is parsed with its contract schema on both ends.**
   `AuditStreamEvent`, `BroadcastStreamEvent`, `ScanStreamFrame` — the relay
   forwards nothing it has not validated, and the client renders nothing it has
   not validated. A malformed frame is dropped and logged, never thrown on and
   never echoed.
4. **Backpressure drops the reader, never buffers for it.** Above 1 MB
   unwritten, the connection is closed (SSE) or the socket is (WS, code 1013).
   Holding log entries in memory for a client that is not reading them is how
   an API runs out of memory, and a security console that falls behind should
   reconnect and replay, not be carried.
5. **Caps are per person, not global.** Five audit streams and three scan
   sockets per user per job, 400 process-wide: one browser in a reconnect loop
   must not take the console away from the rest of the team.
6. **The scan terminal's control channel is a whitelist, not a protocol.**
   `ScanClientMessage` is `.strict()` with four members — `abort`, `pause`,
   `resume`, `kill` — so an extra property is a rejection rather than a field
   silently carried to the controller. The hook exposes `sendControl` and no
   generic send. Rate budget 5/s, five invalid messages closes the socket.
   `kill` requires `admin`/`super_admin`; nothing is accepted unless the job is
   `running`; and every accepted verb is audited (`SCAN_CONTROL_SENT`) BEFORE
   it is published — an unrecorded hand on a running scan is what the chain
   exists to prevent.
7. **Cookies authenticate the handshake, Origin is what makes that safe.** The
   browser WebSocket API cannot set a header, so the relay enforces an exact
   `Origin` match and audits a mismatch as `CSRF_REJECTED`. The API-side origin
   lock (`x-origin-verify`, ADR 0006) means a request that bypasses Cloudflare
   is refused anyway.
8. **Clients get no live scan output.** The relay is `requireStaff`; the
   release lock means a customer sees the released report and nothing of the
   run that produced it. This is why the Task 96 planner title dropped the
   client-portal terminal: a UI for a socket the API refuses would be a lie.

## Consequences

- Two mechanisms to operate, not one — accepted, because the alternative is a
  write channel on surfaces that must never write.
- SSE cannot resume a broadcast progress stream (no ids: it is idempotent
  state, not a log), so a reconnect re-snapshots instead. Correct for state,
  and the reason the two streams differ.
- Anything new that wants to "just use websockets" now has to argue against a
  recorded decision.

## Enforcement

- `apps/api/src/conformance/route-table.test.ts` knows every route; the stream
  routes are listed in `NO_JSON_RESPONSE` with their guards asserted.
- Relay and session suites (Tasks 39/94/95) pin the close-code table, the
  ordering guarantee across the replay seam, the whitelist and the caps;
  Task 106's loop suite proves controller → relay → terminal agreement with
  the real modules on all three hops.
- Browser-side hooks are tested with fake `EventSource`/`WebSocket`, so the
  client's parsing and fallbacks are covered without a server.
