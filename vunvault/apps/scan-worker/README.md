# scan-worker

The VUNVAULT scan controller. It consumes the `scan` BullMQ queue and runs **one
unprivileged pod per scan** — it never runs a scanning tool in its own process.

## Isolation model

The controller runs where untrusted targets are scanned, so it is treated as
compromised-by-default:

- **No database credentials.** State reaches the platform only through the
  HMAC-signed callbacks in `adapters/signed-api-client.ts` (Task 40g). The
  signature *is* the controller's identity.
- **No name resolution in the pod.** `domain/target-guard.ts` resolves the target
  itself and hands the pod **pinned IPs**, so a DNS record that changes between
  authorisation and execution cannot redirect a scan inward (rebinding defence).
- **Forbidden ranges are rejected outright** — RFC 1918, loopback, link-local
  (which contains the cloud metadata address `169.254.169.254`), carrier NAT,
  multicast, reserved, test nets and broadcast. One forbidden A record rejects
  the whole target. IPv6 is out of scope in v1.
- **Worker slots are a Redis semaphore** (`domain/slots.ts`), so the ceiling
  holds across replicas and a dead controller cannot leak capacity.
- **Control signals are whitelisted.** Only `abort`, `pause`, `resume` and `kill`
  survive Zod validation on `scan:ctl:<jobId>`; anything else is dropped.

## Layout

`ports.ts` declares every seam (`ApiClient`, `PodRunner`, `RedisBus`, `Clock`,
`SlotSemaphore`), so `domain/` is pure and testable with fakes.

## Running locally with fakes

```bash
cp .env.example .env        # fill in REDIS_URL, API_INTERNAL_URL, SCAN_CONTROLLER_HMAC_KEY
pnpm --filter scan-worker dev
```

Tests need no Redis and no cluster — they inject fakes:

```bash
pnpm --filter scan-worker test
```

`bootstrap({ podRunner })` accepts a stand-in runner, which is how the suite
drives the whole claim → validate → run → report flow in memory. Task 86 supplies
the real Kubernetes `PodRunner`; until then the default runner fails the job
rather than pretending to scan.
